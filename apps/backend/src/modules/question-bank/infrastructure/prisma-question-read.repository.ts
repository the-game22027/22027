import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '@generated/prisma/client';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { NameWord } from '../domain/answer-catalog';
import type { AnswerKind, EntityKind, GameBody } from '../domain/question-content';
import type {
  CatalogEntityView,
  ContentSelectionCriteria,
  QuestionReadRepository,
  SlotAnswers,
  StoredGameContent,
} from '../application/ports/question-read-repository';

const CATALOG_ENTITY_COLUMNS = { id: true, kind: true, names: true, popularity: true } as const;

type CatalogEntityRow = Prisma.AnswerEntityGetPayload<{ select: typeof CATALOG_ENTITY_COLUMNS }>;

const catalogEntityOf = (row: CatalogEntityRow): CatalogEntityView => ({
  id: row.id,
  kind: row.kind as EntityKind,
  names: row.names as unknown as CatalogEntityView['names'],
  popularity: row.popularity,
});

@Injectable()
export class PrismaQuestionReadRepository implements QuestionReadRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async pickRandomContentIds(criteria: ContentSelectionCriteria): Promise<string[]> {
    const difficultyFilter = criteria.difficulties
      ? Prisma.sql`AND q.difficulty = ANY(${[...criteria.difficulties]}::int[])`
      : Prisma.empty;
    const answersPerSlotFilter =
      criteria.minAnswersPerSlot === undefined
        ? Prisma.empty
        : Prisma.sql`AND NOT EXISTS (
            SELECT 1 FROM question_answers a WHERE a.question_id = q.id
            GROUP BY a.slot HAVING count(*) < ${criteria.minAnswersPerSlot})`;
    // ORDER BY random() reads every matching row; fine for thousands per game type (08 §5.4).
    const rows = await this.txHost.tx.$queryRaw<{ id: string }[]>`
      SELECT q.id FROM questions q
      WHERE q.status = 'PUBLISHED'
        AND q.game_type = ${criteria.gameType}::battle_game_type
        AND q.available_locales @> ${[...criteria.locales]}::text[]
        AND (q.valid_until IS NULL OR q.valid_until > now())
        AND NOT (q.id = ANY(${[...criteria.excludeContentIds]}::uuid[]))
        ${difficultyFilter}
        ${answersPerSlotFilter}
      ORDER BY random()
      LIMIT ${criteria.count}`;
    return rows.map((row) => row.id);
  }

  async findGameContent(contentId: string): Promise<StoredGameContent | null> {
    const row = await this.txHost.tx.question.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        gameType: true,
        answerKind: true,
        difficulty: true,
        content: true,
        answers: { select: { slot: true, entityId: true } },
      },
    });
    // Legacy multiple choice rows have no game columns and are never played (ADR-0015).
    if (!row?.gameType || !row.answerKind || row.content === null) return null;
    return {
      id: row.id,
      gameType: row.gameType,
      answerKind: row.answerKind,
      difficulty: row.difficulty,
      body: row.content as unknown as GameBody,
      answers: row.answers,
    };
  }

  async findEntityIdsByExternalRefs(externalRefs: readonly string[]): Promise<Map<string, string>> {
    if (externalRefs.length === 0) return new Map();
    const rows = await this.txHost.tx.answerEntity.findMany({
      where: { externalRef: { in: [...new Set(externalRefs)] } },
      select: { id: true, externalRef: true },
    });
    return new Map(rows.map((row) => [row.externalRef, row.id]));
  }

  async findSlotAnswers(contentId: string, slot: number): Promise<SlotAnswers | null> {
    const question = await this.txHost.tx.question.findUnique({
      where: { id: contentId },
      select: {
        answerKind: true,
        answers: {
          where: { slot },
          select: { entity: { select: { id: true, popularity: true, searchForms: true, nameWords: true } } },
        },
      },
    });
    if (!question?.answerKind) return null;
    return {
      roundAnswerKind: question.answerKind,
      candidates: question.answers.map(({ entity }) => ({
        entityId: entity.id,
        popularity: entity.popularity,
        searchForms: entity.searchForms,
        nameWords: entity.nameWords as unknown as NameWord[],
      })),
    };
  }

  async findEntityIdNamedExactly(
    kind: AnswerKind,
    form: string,
    excludeIds: readonly string[],
  ): Promise<string | null> {
    // `@>` lets Postgres use the GIN index on search_forms.
    const rows = await this.txHost.tx.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM answer_entities
      WHERE search_forms @> ARRAY[${form}]::text[]
        AND kind = ${kind}::answer_kind
        AND status = 'ACTIVE'
        AND NOT (id = ANY(${[...excludeIds]}::uuid[]))
      ORDER BY popularity DESC, id
      LIMIT 1`;
    return rows[0]?.id ?? null;
  }

  async findEntitiesByIds(entityIds: readonly string[]): Promise<CatalogEntityView[]> {
    const rows = await this.txHost.tx.answerEntity.findMany({
      where: { id: { in: [...new Set(entityIds)] } },
      select: CATALOG_ENTITY_COLUMNS,
    });
    return rows.map(catalogEntityOf);
  }

  async findPopularEntityIdsOfKind(kind: EntityKind, excludeIds: readonly string[], limit: number): Promise<string[]> {
    const rows = await this.txHost.tx.answerEntity.findMany({
      where: { kind, status: 'ACTIVE', id: { notIn: [...excludeIds] } },
      orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
