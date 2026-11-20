import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '@generated/prisma/client';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { NameWord } from '../domain/answer-catalog';
import type { PassType } from '../domain/link-graph';
import type { AnswerKind, EntityKind, GameBody, LocalizedText } from '../domain/question-content';
import type {
  CatalogEntityView,
  CommonNeighbour,
  ContentFilter,
  ContentSelectionCriteria,
  LinkedAnswer,
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
    // ORDER BY random() reads every matching row; fine for thousands per game type (08 §5.4).
    const rows = await this.txHost.tx.$queryRaw<{ id: string }[]>`
      SELECT q.id FROM questions q
      WHERE ${buildPlayableContentCondition(criteria)}
        AND NOT (q.id = ANY(${[...criteria.excludeContentIds]}::uuid[]))
      ORDER BY random()
      LIMIT ${criteria.count}`;
    return rows.map((row) => row.id);
  }

  async pickMatchingContentIdsInGivenOrder(
    filter: ContentFilter,
    candidateContentIds: readonly string[],
  ): Promise<string[]> {
    const rows = await this.txHost.tx.$queryRaw<{ id: string }[]>`
      SELECT q.id FROM unnest(${[...candidateContentIds]}::uuid[]) WITH ORDINALITY AS c(id, position)
      JOIN questions q ON q.id = c.id
      WHERE ${buildPlayableContentCondition(filter)}
      ORDER BY c.position
      LIMIT ${filter.count}`;
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

  async findLinkedAnswers(ballEntityId: string, passType: PassType): Promise<LinkedAnswer[]> {
    // The primary key (from_entity_id, pass_type, to_entity_id) finds these rows without reading the rest.
    const rows = await this.txHost.tx.$queryRaw<
      { entityId: string; popularity: number; searchForms: string[]; nameWords: unknown; evidence: unknown }[]
    >`
      SELECT e.id::text AS "entityId", e.popularity, e.search_forms AS "searchForms", e.name_words AS "nameWords",
             m.evidence
      FROM entity_links l
      JOIN answer_entities e ON e.id = l.to_entity_id AND e.status = 'ACTIVE'
      JOIN link_matches m ON m.id = l.match_id
      WHERE l.from_entity_id = ${ballEntityId}::uuid AND l.pass_type = ${passType}::link_pass_type
      ORDER BY e.popularity DESC, e.id`;
    return rows.map((row) => ({
      entityId: row.entityId,
      popularity: row.popularity,
      searchForms: row.searchForms,
      nameWords: row.nameWords as NameWord[],
      evidence: row.evidence as LocalizedText,
    }));
  }

  async findCommonNeighbours(
    firstEntityId: string,
    secondEntityId: string,
    passType: PassType,
  ): Promise<CommonNeighbour[]> {
    // Both sides are primary-key lookups (from_entity_id, pass_type, …), joined on the neighbour.
    const rows = await this.txHost.tx.$queryRaw<
      {
        entityId: string;
        popularity: number;
        searchForms: string[];
        nameWords: unknown;
        firstEvidence: unknown;
        secondEvidence: unknown;
      }[]
    >`
      SELECT e.id::text AS "entityId", e.popularity, e.search_forms AS "searchForms", e.name_words AS "nameWords",
             first_match.evidence AS "firstEvidence", second_match.evidence AS "secondEvidence"
      FROM entity_links first_link
      JOIN entity_links second_link ON second_link.from_entity_id = ${secondEntityId}::uuid
        AND second_link.pass_type = first_link.pass_type AND second_link.to_entity_id = first_link.to_entity_id
      JOIN answer_entities e ON e.id = first_link.to_entity_id AND e.status = 'ACTIVE'
      JOIN link_matches first_match ON first_match.id = first_link.match_id
      JOIN link_matches second_match ON second_match.id = second_link.match_id
      WHERE first_link.from_entity_id = ${firstEntityId}::uuid AND first_link.pass_type = ${passType}::link_pass_type
      ORDER BY e.popularity DESC, e.id`;
    return rows.map((row) => ({
      entityId: row.entityId,
      popularity: row.popularity,
      searchForms: row.searchForms,
      nameWords: row.nameWords as NameWord[],
      evidence: [row.firstEvidence as LocalizedText, row.secondEvidence as LocalizedText],
    }));
  }

  async countUnusedLinks(
    ballEntityId: string,
    burnedEntityIds: readonly string[],
  ): Promise<Partial<Record<PassType, number>>> {
    const rows = await this.txHost.tx.$queryRaw<{ passType: PassType; unused: number }[]>`
      SELECT c.pass_type::text AS "passType", c.neighbour_count - coalesce(burned.count, 0) AS unused
      FROM entity_link_counts c
      LEFT JOIN (
        SELECT pass_type, count(*)::int AS count FROM entity_links
        WHERE from_entity_id = ${ballEntityId}::uuid AND to_entity_id = ANY(${[...burnedEntityIds]}::uuid[])
        GROUP BY pass_type
      ) burned ON burned.pass_type = c.pass_type
      WHERE c.entity_id = ${ballEntityId}::uuid`;
    return Object.fromEntries(rows.filter((row) => row.unused > 0).map((row) => [row.passType, row.unused]));
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

/** Published, unexpired content of the filter's game type, playable in its locales (08 §5.4). Table alias `q`. */
function buildPlayableContentCondition(filter: ContentFilter): Prisma.Sql {
  const difficultyFilter = filter.difficulties
    ? Prisma.sql`AND q.difficulty = ANY(${[...filter.difficulties]}::int[])`
    : Prisma.empty;
  const answersPerSlotFilter =
    filter.minAnswersPerSlot === undefined
      ? Prisma.empty
      : Prisma.sql`AND NOT EXISTS (
          SELECT 1 FROM question_answers a WHERE a.question_id = q.id
          GROUP BY a.slot HAVING count(*) < ${filter.minAnswersPerSlot})`;
  return Prisma.sql`q.status = 'PUBLISHED'
    AND q.game_type = ${filter.gameType}::battle_game_type
    AND q.available_locales @> ${[...filter.locales]}::text[]
    AND (q.valid_until IS NULL OR q.valid_until > now())
    ${difficultyFilter}
    ${answersPerSlotFilter}`;
}
