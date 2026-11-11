import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { decideImportAction, type ImportDecision } from '../domain/import-decision';
import { BundleVersionReusedError, InvalidBundleError } from '../domain/question-bank-errors';
import {
  type BundleQuestion,
  computeContentHash,
  type GameContent,
  localesOfQuestion,
} from '../domain/question-content';
import { findCatalogReferenceProblems } from '../domain/question-rules';
import { type BundleFiles, parseBundle } from './bundle-parser';
import {
  type ActiveEntity,
  QUESTION_IMPORT_REPOSITORY,
  type QuestionImportRepository,
  type QuestionWrite,
  type ReviewUpdate,
} from './ports/question-import-repository';

// A bundle is imported all or nothing in one transaction; tens of thousands of rows need more than Prisma's 5 s default.
const IMPORT_TRANSACTION_TIMEOUT_MS = 10 * 60_000;

export interface ImportCounts {
  inserted: number;
  unchanged: number;
  reviewsRecorded: number;
  contentReplaced: number;
  newVersions: number;
}

export interface ImportSummary {
  bundleVersion: string;
  alreadyImported: boolean;
  counts: ImportCounts;
  /** Entities in the bundle's catalog, or null when it carried none. */
  catalogSize: number | null;
}

const COUNT_FOR_ACTION: Record<ImportDecision['action'], keyof ImportCounts> = {
  INSERT: 'inserted',
  UNCHANGED: 'unchanged',
  RECORD_REVIEWS: 'reviewsRecorded',
  REPLACE_CONTENT: 'contentReplaced',
  INSERT_NEW_VERSION: 'newVersions',
};

const emptyCounts = (): ImportCounts => ({
  inserted: 0,
  unchanged: 0,
  reviewsRecorded: 0,
  contentReplaced: 0,
  newVersions: 0,
});

/** Every catalog entity a game round points at: answers, players, clubs, grid criteria. */
const referencesOf = (content: GameContent): string[] => {
  const refs = content.answers.flatMap((answer) => answer.entities);
  const { body } = content;
  switch (body.gameType) {
    case 'CAREER':
      return [...refs, body.player, ...body.spells.map((spell) => spell.club)];
    case 'WHO_IS_PLAYER':
      return [...refs, body.player];
    case 'GRID':
      return [...refs, ...body.rows.map((row) => row.entity), ...body.cols.map((col) => col.entity)];
    case 'BUZZER':
      return refs;
  }
};

const answerRowsOf = (question: BundleQuestion, entities: Map<string, ActiveEntity>): QuestionWrite['answerRows'] =>
  question.content.type === 'GAME'
    ? question.content.answers.flatMap((answer) =>
        answer.entities.map((ref) => {
          const entity = entities.get(ref);
          if (!entity) throw new Error(`Entity ${ref} was checked but not found`);
          return { slot: answer.slot, entityId: entity.id };
        }),
      )
    : [];

@Injectable()
export class ImportQuestionBundle {
  constructor(
    @Inject(QUESTION_IMPORT_REPOSITORY) private readonly repository: QuestionImportRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Transactional<TransactionalAdapterPrisma<PrismaService>>({ timeout: IMPORT_TRANSACTION_TIMEOUT_MS })
  async importBundle(files: BundleFiles): Promise<ImportSummary> {
    const { manifest, questions, catalog } = parseBundle(files);
    const { bundleVersion } = manifest;
    const catalogChecksum = manifest.catalogChecksum ?? null;
    const catalogSize = manifest.catalogChecksum ? catalog.length : null;
    await this.repository.waitForOtherImports();

    const previous = await this.repository.findBatchChecksums(bundleVersion);
    if (previous && previous.checksum === manifest.checksum && previous.catalogChecksum === catalogChecksum) {
      return { bundleVersion, alreadyImported: true, counts: emptyCounts(), catalogSize };
    }
    if (previous !== null) throw new BundleVersionReusedError(bundleVersion);

    const at = this.clock.now();
    if (manifest.catalogChecksum) {
      // A bundle's catalog is the whole catalog: entities it no longer lists are hidden.
      await this.repository.replaceActiveCatalog(
        catalog.map((entity) => ({ id: this.ids.next(), ...entity })),
        bundleVersion,
        at,
      );
    }
    const entities = await this.findEntitiesUsedByGames(questions);

    const categoryIds = await this.repository.saveCategories(
      manifest.categories.map((category) => ({ id: this.ids.next(), ...category })),
    );
    const latestVersions = await this.repository.findLatestVersions(questions.map((question) => question.externalKey));

    const batchId = this.ids.next();
    const counts = emptyCounts();
    const inserts: QuestionWrite[] = [];
    const replacements: QuestionWrite[] = [];
    const reviews: ReviewUpdate[] = [];
    const superseded: string[] = [];
    for (const question of questions) {
      const contentHash = computeContentHash(question.content);
      const decision = decideImportAction(latestVersions.get(question.externalKey) ?? null, {
        contentHash,
        locales: localesOfQuestion(question.content),
        reviewedLocales: question.reviewedLocales,
      });
      counts[COUNT_FOR_ACTION[decision.action]] += 1;
      const write = (id: string, keyVersion: number, status: QuestionWrite['status']): QuestionWrite => ({
        id,
        externalKey: question.externalKey,
        keyVersion,
        contentHash,
        categoryId: this.categoryIdOf(categoryIds, question),
        status,
        question,
        optionIds: question.content.type === 'SINGLE_CHOICE' ? question.content.options.map(() => this.ids.next()) : [],
        answerRows: answerRowsOf(question, entities),
        importBatchId: batchId,
        at,
      });

      switch (decision.action) {
        case 'INSERT':
          inserts.push(write(this.ids.next(), 1, decision.status));
          break;
        case 'INSERT_NEW_VERSION':
          inserts.push(write(this.ids.next(), decision.keyVersion, decision.status));
          if (decision.disableQuestionId) superseded.push(decision.disableQuestionId);
          break;
        case 'REPLACE_CONTENT':
          replacements.push(write(decision.questionId, decision.keyVersion, decision.status));
          break;
        case 'RECORD_REVIEWS':
          reviews.push({
            questionId: decision.questionId,
            newlyReviewedLocales: decision.newlyReviewedLocales,
            approve: decision.approve,
          });
          break;
        case 'UNCHANGED':
          break;
      }
    }

    await this.repository.insertBatch({
      id: batchId,
      bundleVersion,
      checksum: manifest.checksum,
      catalogChecksum,
      generatorVersion: manifest.generatorVersion,
      kbVersion: manifest.kbVersion,
      stats: { ...counts },
      importedAt: at,
    });
    await this.repository.disableQuestions(superseded, 'SUPERSEDED', at);
    await this.repository.insertQuestions(inserts);
    await this.repository.replaceContent(replacements);
    await this.repository.recordReviews(reviews, at);
    return { bundleVersion, alreadyImported: false, counts, catalogSize };
  }

  /**
   * Looks up every catalog entity the game lines point at and checks kinds; throws InvalidBundleError
   * listing every problem. Runs inside the transaction, so a rejected bundle also leaves the catalog as it was.
   */
  private async findEntitiesUsedByGames(questions: readonly BundleQuestion[]): Promise<Map<string, ActiveEntity>> {
    const games = questions.filter(
      (question): question is BundleQuestion & { content: GameContent } => question.content.type === 'GAME',
    );
    const entities = await this.repository.findActiveEntities(games.flatMap(({ content }) => referencesOf(content)));
    const problems = questions.flatMap((question, index) =>
      question.content.type === 'GAME'
        ? findCatalogReferenceProblems(question.content, (ref) => entities.get(ref)).map(
            (problem) => `line ${index + 1}: ${problem}`,
          )
        : [],
    );
    if (problems.length > 0) throw new InvalidBundleError(problems);
    return entities;
  }

  private categoryIdOf(categoryIds: Map<string, string>, question: BundleQuestion): string {
    const id = categoryIds.get(question.content.category);
    if (!id) throw new Error(`Category ${question.content.category} was validated but not saved`);
    return id;
  }
}
