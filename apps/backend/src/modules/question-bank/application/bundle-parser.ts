import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type Locale, LOCALES } from '@shared/kernel';
import type { CatalogEntity } from '../domain/answer-catalog';
import { InvalidBundleError } from '../domain/question-bank-errors';
import { ANSWER_KINDS, type BundleQuestion, ENTITY_KINDS, type GameBody } from '../domain/question-content';
import { findQuestionProblems, findRepeatedValues } from '../domain/question-rules';

const nonEmpty = z.string().trim().min(1);
const locale = z.enum(LOCALES);
const checksum = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'expected sha256:<64 hex characters>');
const externalRef = z.string().regex(/^[a-z]+:[A-Za-z0-9_-]+$/, 'expected <source>:<id>, e.g. wikidata:Q11571');
const localizedText = z.partialRecord(locale, z.string());

const manifestSchema = z.strictObject({
  bundleVersion: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/, 'use 1-64 letters, digits, dots, dashes or underscores'),
  kbVersion: nonEmpty,
  generatorVersion: nonEmpty,
  questionCount: z.number().int().nonnegative(),
  checksum,
  /** Present when the bundle carries an answer catalog (catalog.jsonl). */
  catalogChecksum: checksum.optional(),
  categories: z.array(
    z.strictObject({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined by dashes'),
      names: z.strictObject({ en: nonEmpty, ar: nonEmpty.optional() }),
    }),
  ),
});

const provenance = z.strictObject({
  facts: z.array(nonEmpty),
  sources: z.array(nonEmpty),
  licenses: z.array(nonEmpty),
  kbVersion: nonEmpty,
});

const commonLineFields = {
  externalKey: z.string().min(1).max(200),
  category: z.string(),
  difficulty: z.number(),
  provenance,
  validUntil: z.iso.datetime({ offset: true }).nullish(),
  humanReviewed: z.partialRecord(locale, z.boolean()).optional(),
};

const singleChoiceLineSchema = z.strictObject({
  ...commonLineFields,
  type: z.literal('SINGLE_CHOICE'),
  locales: z.partialRecord(locale, z.strictObject({ text: z.string(), explanation: z.string().nullish() })),
  options: z.array(
    z.strictObject({
      position: z.number().int(),
      isCorrect: z.boolean(),
      entityRef: nonEmpty.nullish(),
      locales: z.partialRecord(locale, z.string()),
    }),
  ),
});

const gridCriterion = z.strictObject({
  kind: z.enum(['CLUB', 'NATIONALITY', 'COMPETITION_WON']),
  entity: externalRef,
});

const minesCriterion = z.union([
  z.strictObject({ kind: z.enum(['CLUB', 'NATIONALITY']), entity: externalRef }),
  z.strictObject({ kind: z.literal('DECADE'), fromYear: z.number().int() }),
]);

const gameLineSchema = z.strictObject({
  ...commonLineFields,
  type: z.literal('GAME'),
  gameType: z.enum(['BUZZER', 'CAREER', 'WHO_IS_PLAYER', 'GRID', 'MINES']),
  content: z.record(z.string(), z.unknown()),
  answers: z.array(z.strictObject({ slot: z.number().int(), entities: z.array(externalRef) })).default([]),
});

const gameBodySchemas = {
  BUZZER: z.strictObject({
    answerKind: z.enum(ANSWER_KINDS),
    steps: z.partialRecord(locale, z.array(z.string())),
    explanation: localizedText.nullish(),
    answerNumber: z.number().nullish(),
  }),
  CAREER: z.strictObject({
    player: externalRef,
    spells: z.array(
      z.strictObject({
        club: externalRef,
        fromYear: z.number().int(),
        toYear: z.number().int().nullable(),
        loan: z.boolean().default(false),
      }),
    ),
  }),
  WHO_IS_PLAYER: z.strictObject({
    player: externalRef,
    clues: z.array(z.strictObject({ kind: nonEmpty, text: localizedText })),
  }),
  GRID: z.strictObject({ rows: z.array(gridCriterion), cols: z.array(gridCriterion) }),
  MINES: z.strictObject({ criteria: z.array(minesCriterion) }),
} as const;

const catalogLineSchema = z.strictObject({
  externalRef,
  kind: z.enum(ENTITY_KINDS),
  names: z.strictObject({ en: nonEmpty, ar: nonEmpty }),
  aliases: z.strictObject({ en: z.array(nonEmpty), ar: z.array(nonEmpty) }),
  popularity: z.number().int().nonnegative(),
  search: z.array(nonEmpty).min(1),
  // Optional: bundles made before ADR-0021 have none, and then only full names and aliases count.
  nameWords: z.array(z.strictObject({ form: nonEmpty, sharedBy: z.number().int().positive() })).default([]),
});

export type BundleManifest = z.infer<typeof manifestSchema>;

export interface BundleFiles {
  manifestJson: string;
  /** Raw bytes, because the manifest checksum is over the exact file content. */
  questionsJsonl: Uint8Array;
  /** catalog.jsonl when the bundle has one. */
  catalogJsonl?: Uint8Array;
}

export interface ParsedBundle {
  manifest: BundleManifest;
  questions: BundleQuestion[];
  /** Empty when the bundle carries no catalog: content then refers to the catalog already imported. */
  catalog: CatalogEntity[];
}

const describeIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`);

const parseJson = (text: string): { value: unknown } | { error: string } => {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (error) {
    return { error: `not valid JSON (${(error as Error).message})` };
  }
};

const reviewedLocalesOf = (humanReviewed: Partial<Record<Locale, boolean>> | undefined): Locale[] =>
  (Object.entries(humanReviewed ?? {}) as [Locale, boolean][])
    .filter(([, reviewed]) => reviewed)
    .map(([reviewedLocale]) => reviewedLocale)
    .sort();

const toSingleChoiceQuestion = (line: z.infer<typeof singleChoiceLineSchema>): BundleQuestion => ({
  externalKey: line.externalKey,
  content: {
    type: line.type,
    category: line.category,
    difficulty: line.difficulty,
    locales: Object.fromEntries(
      Object.entries(line.locales).map(([key, value]) => [
        key,
        { text: value.text, explanation: value.explanation ?? null },
      ]),
    ),
    options: line.options.map((option) => ({
      position: option.position,
      isCorrect: option.isCorrect,
      entityRef: option.entityRef ?? null,
      locales: option.locales,
    })),
    validUntil: line.validUntil ? new Date(line.validUntil) : null,
  },
  provenance: line.provenance,
  reviewedLocales: reviewedLocalesOf(line.humanReviewed),
});

const toGameBody = (gameType: GameBody['gameType'], content: unknown): { body: GameBody } | { issues: string[] } => {
  switch (gameType) {
    case 'BUZZER': {
      const result = gameBodySchemas.BUZZER.safeParse(content);
      if (!result.success) return { issues: describeIssues(result.error) };
      const { answerKind, steps, explanation, answerNumber } = result.data;
      return {
        body: { gameType, answerKind, steps, explanation: explanation ?? null, answerNumber: answerNumber ?? null },
      };
    }
    case 'CAREER': {
      const result = gameBodySchemas.CAREER.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'WHO_IS_PLAYER': {
      const result = gameBodySchemas.WHO_IS_PLAYER.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'GRID': {
      const result = gameBodySchemas.GRID.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'MINES': {
      const result = gameBodySchemas.MINES.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
  }
};

/** One questions.jsonl line → a question, or the reasons it is not one. */
const parseQuestionLine = (value: unknown): { question: BundleQuestion } | { issues: string[] } => {
  const isGameLine = typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'GAME';
  if (!isGameLine) {
    const result = singleChoiceLineSchema.safeParse(value);
    return result.success
      ? { question: toSingleChoiceQuestion(result.data) }
      : { issues: describeIssues(result.error) };
  }
  const result = gameLineSchema.safeParse(value);
  if (!result.success) return { issues: describeIssues(result.error) };
  const line = result.data;
  const parsedBody = toGameBody(line.gameType, line.content);
  if ('issues' in parsedBody) return { issues: parsedBody.issues.map((issue) => `content.${issue}`) };
  return {
    question: {
      externalKey: line.externalKey,
      content: {
        type: 'GAME',
        category: line.category,
        difficulty: line.difficulty,
        body: parsedBody.body,
        answers: line.answers,
        validUntil: line.validUntil ? new Date(line.validUntil) : null,
      },
      provenance: line.provenance,
      reviewedLocales: reviewedLocalesOf(line.humanReviewed),
    },
  };
};

const splitLines = (bytes: Uint8Array): string[] => {
  const lines = Buffer.from(bytes).toString('utf8').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

function parseCatalog(bytes: Uint8Array, problems: string[]): CatalogEntity[] {
  const entities: CatalogEntity[] = [];
  splitLines(bytes).forEach((text, index) => {
    const where = `catalog.jsonl line ${index + 1}`;
    const json = parseJson(text);
    if ('error' in json) return void problems.push(`${where}: ${json.error}`);
    const result = catalogLineSchema.safeParse(json.value);
    if (!result.success)
      return void problems.push(...describeIssues(result.error).map((issue) => `${where}: ${issue}`));
    const { search, ...entity } = result.data;
    entities.push({ ...entity, searchForms: search });
  });
  for (const ref of findRepeatedValues(entities.map((entity) => entity.externalRef))) {
    problems.push(`catalog.jsonl: ${ref} appears more than once`);
  }
  return entities;
}

export function computeChecksum(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * Reads and checks a whole bundle without the database. Throws InvalidBundleError listing every problem.
 * Checks against the catalog already imported happen later, inside the import transaction.
 */
export function parseBundle(files: BundleFiles): ParsedBundle {
  const manifestJson = parseJson(files.manifestJson);
  if ('error' in manifestJson) throw new InvalidBundleError([`manifest.json is ${manifestJson.error}`]);
  const manifestResult = manifestSchema.safeParse(manifestJson.value);
  if (!manifestResult.success) {
    throw new InvalidBundleError(describeIssues(manifestResult.error).map((issue) => `manifest.json: ${issue}`));
  }
  const manifest = manifestResult.data;
  const problems: string[] = [];

  if (computeChecksum(files.questionsJsonl) !== manifest.checksum) {
    problems.push('questions.jsonl does not match the manifest checksum');
  }
  let catalog: CatalogEntity[] = [];
  if (manifest.catalogChecksum && !files.catalogJsonl) {
    problems.push('the manifest has a catalogChecksum but the bundle has no catalog.jsonl');
  } else if (!manifest.catalogChecksum && files.catalogJsonl) {
    problems.push('the bundle has a catalog.jsonl but the manifest has no catalogChecksum');
  } else if (manifest.catalogChecksum && files.catalogJsonl) {
    if (computeChecksum(files.catalogJsonl) !== manifest.catalogChecksum) {
      problems.push('catalog.jsonl does not match the manifest catalogChecksum');
    }
    catalog = parseCatalog(files.catalogJsonl, problems);
  }

  const slugs = manifest.categories.map((category) => category.slug);
  for (const slug of findRepeatedValues(slugs)) problems.push(`manifest.json: category "${slug}" is listed twice`);

  const knownCategories = new Set(slugs);
  const lines = splitLines(files.questionsJsonl);
  const questions: BundleQuestion[] = [];
  lines.forEach((text, index) => {
    const where = `line ${index + 1}`;
    const json = parseJson(text);
    if ('error' in json) return void problems.push(`${where}: ${json.error}`);
    const parsed = parseQuestionLine(json.value);
    if ('issues' in parsed) return void problems.push(...parsed.issues.map((issue) => `${where}: ${issue}`));
    problems.push(...findQuestionProblems(parsed.question, knownCategories).map((problem) => `${where}: ${problem}`));
    questions.push(parsed.question);
  });

  if (lines.length !== manifest.questionCount) {
    problems.push(
      `the manifest says ${manifest.questionCount} questions but questions.jsonl has ${lines.length} lines`,
    );
  }
  for (const key of findRepeatedValues(questions.map((question) => question.externalKey))) {
    problems.push(`externalKey "${key}" appears more than once`);
  }
  if (problems.length > 0) throw new InvalidBundleError(problems);
  return { manifest, questions, catalog };
}
