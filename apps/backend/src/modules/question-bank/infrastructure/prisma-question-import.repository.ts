import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '@generated/prisma/client';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { Locale } from '@shared/kernel';
import type { EntityKind } from '../domain/question-content';
import { takeContentChangeLock } from './content-change-lock';
import type { LatestQuestionVersion } from '../domain/import-decision';
import { answerKindOfGame, localesOfQuestion, summaryTextOfQuestion } from '../domain/question-content';
import type {
  ActiveEntity,
  CatalogEntityWrite,
  CategoryWrite,
  ImportBatchWrite,
  ImportedBatchChecksums,
  QuestionImportRepository,
  QuestionWrite,
  ReviewUpdate,
} from '../application/ports/question-import-repository';

// Rows per statement when writing the catalog: big enough to be fast, small enough for Postgres' parameter limits.
const CATALOG_CHUNK_SIZE = 2_000;

const chunksOf = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
};

/** The question columns that come from the bundle, shared by insert and replace. */
const contentColumns = ({ question, contentHash, categoryId, status, importBatchId, at }: QuestionWrite) => ({
  contentHash,
  type: question.content.type,
  ...(question.content.type === 'GAME'
    ? {
        gameType: question.content.body.gameType,
        answerKind: answerKindOfGame(question.content.body),
        content: question.content.body as unknown as Prisma.InputJsonValue,
      }
    : { gameType: null, answerKind: null, content: Prisma.DbNull }),
  categoryId,
  difficulty: question.content.difficulty,
  status,
  availableLocales: localesOfQuestion(question.content),
  provenance: question.provenance as unknown as Prisma.InputJsonValue,
  licenseFlags: [...new Set(question.provenance.licenses)],
  validUntil: question.content.validUntil,
  importBatchId,
  updatedAt: at,
});

const translationRows = ({ id, question }: QuestionWrite) =>
  localesOfQuestion(question.content).map((locale) => ({
    questionId: id,
    locale,
    text: summaryTextOfQuestion(question.content, locale),
    explanation: explanationOf(question, locale),
    humanReviewed: question.reviewedLocales.includes(locale),
  }));

const explanationOf = ({ content }: QuestionWrite['question'], locale: Locale): string | null => {
  if (content.type === 'SINGLE_CHOICE') return content.locales[locale]?.explanation ?? null;
  return content.body.gameType === 'BUZZER' ? (content.body.explanation?.[locale] ?? null) : null;
};

const optionsOf = ({ question }: QuestionWrite) =>
  question.content.type === 'SINGLE_CHOICE' ? question.content.options : [];

const optionRows = (write: QuestionWrite) =>
  optionsOf(write).map((option, index) => ({
    id: write.optionIds[index],
    questionId: write.id,
    position: option.position,
    isCorrect: option.isCorrect,
    entityRef: option.entityRef,
  }));

const optionTranslationRows = (write: QuestionWrite) =>
  optionsOf(write).flatMap((option, index) =>
    (Object.entries(option.locales) as [Locale, string][]).map(([locale, text]) => ({
      optionId: write.optionIds[index],
      locale,
      text,
    })),
  );

@Injectable()
export class PrismaQuestionImportRepository implements QuestionImportRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async waitForOtherImports(): Promise<void> {
    await takeContentChangeLock(this.txHost.tx);
  }

  async findBatchChecksums(bundleVersion: string): Promise<ImportedBatchChecksums | null> {
    return this.txHost.tx.questionImportBatch.findUnique({
      where: { bundleVersion },
      select: { checksum: true, catalogChecksum: true },
    });
  }

  async insertBatch(batch: ImportBatchWrite): Promise<void> {
    await this.txHost.tx.questionImportBatch.create({ data: { ...batch, status: 'IMPORTED' } });
  }

  async replaceActiveCatalog(entities: readonly CatalogEntityWrite[], catalogVersion: string, at: Date): Promise<void> {
    const { tx } = this.txHost;
    for (const chunk of chunksOf(entities, CATALOG_CHUNK_SIZE)) {
      // One statement per chunk instead of one per entity: 20k+ entities would otherwise take minutes.
      const saved = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO answer_entities (id, external_ref, kind, names, popularity, search_forms, catalog_version, status, updated_at)
        SELECT row.id, row.external_ref, row.kind::answer_kind, row.names::jsonb, row.popularity,
               ARRAY(SELECT json_array_elements_text(row.search_forms::json)), ${catalogVersion}, 'ACTIVE', ${at}
        FROM unnest(${chunk.map((e) => e.id)}::uuid[], ${chunk.map((e) => e.externalRef)}::text[],
                    ${chunk.map((e) => e.kind)}::text[], ${chunk.map((e) => JSON.stringify(e.names))}::text[],
                    ${chunk.map((e) => e.popularity)}::int[], ${chunk.map((e) => JSON.stringify(e.searchForms))}::text[])
             AS row(id, external_ref, kind, names, popularity, search_forms)
        ON CONFLICT (external_ref) DO UPDATE SET
          kind = EXCLUDED.kind, names = EXCLUDED.names, popularity = EXCLUDED.popularity,
          search_forms = EXCLUDED.search_forms, catalog_version = EXCLUDED.catalog_version,
          status = 'ACTIVE', updated_at = EXCLUDED.updated_at
        RETURNING id::text`;
      const savedIds = saved.map((row) => row.id);
      await tx.$executeRaw`DELETE FROM answer_entity_aliases WHERE entity_id = ANY(${savedIds}::uuid[])`;
      const aliases = chunk.flatMap((entity) =>
        (['en', 'ar'] as const).flatMap((locale) =>
          [...new Set(entity.aliases[locale])].map((alias) => ({ ref: entity.externalRef, locale, alias })),
        ),
      );
      if (aliases.length === 0) continue;
      await tx.$executeRaw`
        INSERT INTO answer_entity_aliases (entity_id, locale, alias)
        SELECT e.id, row.locale, row.alias
        FROM unnest(${aliases.map((a) => a.ref)}::text[], ${aliases.map((a) => a.locale)}::text[],
                    ${aliases.map((a) => a.alias)}::text[]) AS row(external_ref, locale, alias)
        JOIN answer_entities e ON e.external_ref = row.external_ref`;
    }
    await tx.$executeRaw`
      UPDATE answer_entities SET status = 'HIDDEN', updated_at = ${at}
      WHERE status = 'ACTIVE' AND NOT (external_ref = ANY(${entities.map((e) => e.externalRef)}::text[]))`;
  }

  async findActiveEntities(externalRefs: readonly string[]): Promise<Map<string, ActiveEntity>> {
    if (externalRefs.length === 0) return new Map();
    const rows = await this.txHost.tx.$queryRaw<
      { id: string; externalRef: string; kind: EntityKind; names: ActiveEntity['names'] }[]
    >`
      SELECT id::text, external_ref AS "externalRef", kind::text AS kind, names
      FROM answer_entities
      WHERE status = 'ACTIVE' AND external_ref = ANY(${[...new Set(externalRefs)]}::text[])`;
    return new Map(rows.map(({ externalRef, ...entity }) => [externalRef, entity]));
  }

  async saveCategories(categories: readonly CategoryWrite[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const { id, slug, names } of categories) {
      const rows = await this.txHost.tx.$queryRaw<{ id: string }[]>`
        INSERT INTO question_categories (id, slug, names)
        VALUES (${id}::uuid, ${slug}, ${JSON.stringify(names)}::jsonb)
        ON CONFLICT (slug) DO UPDATE SET names = EXCLUDED.names
        RETURNING id::text`;
      ids.set(slug, rows[0].id);
    }
    return ids;
  }

  async findLatestVersions(externalKeys: readonly string[]): Promise<Map<string, LatestQuestionVersion>> {
    if (externalKeys.length === 0) return new Map();
    const rows = await this.txHost.tx.$queryRaw<(LatestQuestionVersion & { externalKey: string })[]>`
      SELECT DISTINCT ON (q.external_key)
             q.id::text, q.external_key AS "externalKey", q.key_version AS "keyVersion",
             q.content_hash AS "contentHash", q.status::text AS status,
             q.published_at IS NOT NULL AS "wasEverPublished", q.available_locales AS locales,
             ARRAY(SELECT t.locale FROM question_translations t
                   WHERE t.question_id = q.id AND t.human_reviewed ORDER BY t.locale) AS "reviewedLocales"
      FROM questions q
      WHERE q.external_key = ANY(${externalKeys}::text[])
      ORDER BY q.external_key, q.key_version DESC`;
    return new Map(rows.map(({ externalKey, ...latest }) => [externalKey, latest]));
  }

  async insertQuestions(questions: readonly QuestionWrite[]): Promise<void> {
    if (questions.length === 0) return;
    const { tx } = this.txHost;
    await tx.question.createMany({
      data: questions.map((write) => ({
        id: write.id,
        externalKey: write.externalKey,
        keyVersion: write.keyVersion,
        createdAt: write.at,
        ...contentColumns(write),
      })),
    });
    await this.insertChildren(questions);
  }

  async replaceContent(questions: readonly QuestionWrite[]): Promise<void> {
    if (questions.length === 0) return;
    const { tx } = this.txHost;
    const questionIds = questions.map((write) => write.id);
    await tx.questionOption.deleteMany({ where: { questionId: { in: questionIds } } });
    await tx.questionAnswer.deleteMany({ where: { questionId: { in: questionIds } } });
    await tx.questionTranslation.deleteMany({ where: { questionId: { in: questionIds } } });
    for (const write of questions) {
      await tx.question.update({ where: { id: write.id }, data: contentColumns(write) });
    }
    await this.insertChildren(questions);
  }

  async recordReviews(updates: readonly ReviewUpdate[], at: Date): Promise<void> {
    const { tx } = this.txHost;
    for (const { questionId, newlyReviewedLocales, approve } of updates) {
      await tx.questionTranslation.updateMany({
        where: { questionId, locale: { in: newlyReviewedLocales } },
        data: { humanReviewed: true },
      });
      if (approve) {
        await tx.question.updateMany({
          where: { id: questionId, status: 'DRAFT' },
          data: { status: 'APPROVED', updatedAt: at },
        });
      }
    }
  }

  async disableQuestions(questionIds: readonly string[], reason: string, at: Date): Promise<void> {
    if (questionIds.length === 0) return;
    await this.txHost.tx.question.updateMany({
      where: { id: { in: [...questionIds] }, status: { not: 'DISABLED' } },
      data: { status: 'DISABLED', disabledAt: at, disabledReason: reason, updatedAt: at },
    });
  }

  private async insertChildren(questions: readonly QuestionWrite[]): Promise<void> {
    const { tx } = this.txHost;
    await tx.questionTranslation.createMany({ data: questions.flatMap(translationRows) });
    await tx.questionOption.createMany({ data: questions.flatMap(optionRows) });
    await tx.questionOptionTranslation.createMany({ data: questions.flatMap(optionTranslationRows) });
    await tx.questionAnswer.createMany({
      data: questions.flatMap((write) => write.answerRows.map((row) => ({ questionId: write.id, ...row }))),
    });
  }
}
