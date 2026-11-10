import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Prisma } from '@generated/prisma/client';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { Locale } from '@shared/kernel';
import type { LatestQuestionVersion } from '../domain/import-decision';
import { localesOfQuestion } from '../domain/question-content';
import type {
  CategoryWrite,
  ImportBatchWrite,
  QuestionImportRepository,
  QuestionWrite,
  ReviewUpdate,
} from '../application/ports/question-import-repository';

/** The question columns that come from the bundle, shared by insert and replace. */
const contentColumns = ({ question, contentHash, categoryId, status, importBatchId, at }: QuestionWrite) => ({
  contentHash,
  type: question.content.type,
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
    text: question.content.locales[locale]?.text ?? '',
    explanation: question.content.locales[locale]?.explanation ?? null,
    humanReviewed: question.reviewedLocales.includes(locale),
  }));

const optionRows = ({ id, question, optionIds }: QuestionWrite) =>
  question.content.options.map((option, index) => ({
    id: optionIds[index],
    questionId: id,
    position: option.position,
    isCorrect: option.isCorrect,
    entityRef: option.entityRef,
  }));

const optionTranslationRows = ({ question, optionIds }: QuestionWrite) =>
  question.content.options.flatMap((option, index) =>
    (Object.entries(option.locales) as [Locale, string][]).map(([locale, text]) => ({
      optionId: optionIds[index],
      locale,
      text,
    })),
  );

@Injectable()
export class PrismaQuestionImportRepository implements QuestionImportRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async waitForOtherImports(): Promise<void> {
    await this.txHost.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('question-bank:import'))`;
  }

  async findBatchChecksum(bundleVersion: string): Promise<string | null> {
    const batch = await this.txHost.tx.questionImportBatch.findUnique({
      where: { bundleVersion },
      select: { checksum: true },
    });
    return batch?.checksum ?? null;
  }

  async insertBatch(batch: ImportBatchWrite): Promise<void> {
    await this.txHost.tx.questionImportBatch.create({ data: { ...batch, status: 'IMPORTED' } });
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
  }
}
