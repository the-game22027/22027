import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type Locale, LOCALES } from '@shared/kernel';
import type { CatalogEntity } from '../domain/answer-catalog';
import { type BundleLink, type BundleLinkMatch, LINK_TYPES } from '../domain/link-graph';
import { InvalidBundleError } from '../domain/question-bank-errors';
import {
  ANSWER_KINDS,
  type BundleQuestion,
  ENTITY_KINDS,
  GAME_TYPES,
  type GameBody,
  LINEUP_LINES,
} from '../domain/question-content';
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
  /** Present when the bundle carries a ONE_TWO link graph (links.jsonl and link-matches.jsonl, 08 §15.4). */
  linkCount: z.number().int().nonnegative().optional(),
  linksChecksum: checksum.optional(),
  linkMatchesChecksum: checksum.optional(),
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
  gameType: z.enum(GAME_TYPES),
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
  AUCTION: z.strictObject({ lists: z.array(z.strictObject({ kind: nonEmpty, title: localizedText })) }),
  HEX: z.strictObject({
    size: z.number().int(),
    cells: z.array(
      z.strictObject({
        letter: localizedText,
        questions: z.array(z.strictObject({ kind: nonEmpty, title: localizedText })),
      }),
    ),
  }),
  LINEUP: z.strictObject({
    title: localizedText,
    slots: z.array(
      z.strictObject({
        line: z.enum(LINEUP_LINES),
        role: nonEmpty.nullable(),
        shirtNumber: z.number().int().nullable(),
        captain: z.boolean(),
        player: externalRef,
      }),
    ),
    shown: z.array(externalRef),
    fake: externalRef,
  }),
  ONE_TWO: z.strictObject({ seed: externalRef }),
  BRIDGE: z.strictObject({ size: z.number().int(), clubs: z.array(externalRef) }),
  THREAD: z.strictObject({
    rooms: z.array(
      z.strictObject({
        hop: nonEmpty,
        answerKind: z.enum(ENTITY_KINDS),
        text: localizedText,
        jumpText: localizedText.nullable(),
      }),
    ),
  }),
  VAULT: z.strictObject({
    questions: z.array(z.strictObject({ template: nonEmpty, text: localizedText, answerNumber: z.number().int() })),
  }),
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

const linkLineSchema = z.strictObject({
  from: externalRef,
  type: z.enum(LINK_TYPES),
  to: externalRef,
  match: nonEmpty,
});

const linkMatchLineSchema = z.strictObject({
  key: nonEmpty,
  evidence: z.strictObject({ en: nonEmpty, ar: nonEmpty }),
});

export type BundleManifest = z.infer<typeof manifestSchema>;

export interface BundleFiles {
  manifestJson: string;
  /** Raw bytes, because the manifest checksum is over the exact file content. */
  questionsJsonl: Uint8Array;
  /** catalog.jsonl when the bundle has one. */
  catalogJsonl?: Uint8Array;
  /** links.jsonl and link-matches.jsonl when the bundle carries a link graph. */
  linksJsonl?: Uint8Array;
  linkMatchesJsonl?: Uint8Array;
}

/** The ONE_TWO link graph of a bundle: it replaces the imported graph as a whole (08 §15.8). */
export interface BundleLinkGraph {
  links: BundleLink[];
  matches: BundleLinkMatch[];
}

export interface ParsedBundle {
  manifest: BundleManifest;
  questions: BundleQuestion[];
  /** Empty when the bundle carries no catalog: content then refers to the catalog already imported. */
  catalog: CatalogEntity[];
  /** Null when the bundle carries no graph: the imported graph stays as it is. */
  linkGraph: BundleLinkGraph | null;
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
    case 'AUCTION': {
      const result = gameBodySchemas.AUCTION.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'HEX': {
      const result = gameBodySchemas.HEX.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'LINEUP': {
      const result = gameBodySchemas.LINEUP.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'ONE_TWO': {
      const result = gameBodySchemas.ONE_TWO.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'BRIDGE': {
      const result = gameBodySchemas.BRIDGE.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'THREAD': {
      const result = gameBodySchemas.THREAD.safeParse(content);
      return result.success ? { body: { gameType, ...result.data } } : { issues: describeIssues(result.error) };
    }
    case 'VAULT': {
      const result = gameBodySchemas.VAULT.safeParse(content);
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

function parseLines<T>(bytes: Uint8Array, file: string, schema: z.ZodType<T>, problems: string[]): T[] {
  const items: T[] = [];
  splitLines(bytes).forEach((text, index) => {
    const where = `${file} line ${index + 1}`;
    const json = parseJson(text);
    if ('error' in json) return void problems.push(`${where}: ${json.error}`);
    const result = schema.safeParse(json.value);
    if (!result.success)
      return void problems.push(...describeIssues(result.error).map((issue) => `${where}: ${issue}`));
    items.push(result.data);
  });
  return items;
}

/** The link graph files, checked against the manifest and each other; null when the bundle has none. */
function parseLinkGraph(files: BundleFiles, manifest: BundleManifest, problems: string[]): BundleLinkGraph | null {
  const declared = [manifest.linkCount, manifest.linksChecksum, manifest.linkMatchesChecksum];
  const present = [files.linksJsonl, files.linkMatchesJsonl];
  if (declared.every((value) => value === undefined) && present.every((file) => file === undefined)) return null;
  if (declared.some((value) => value === undefined) || present.some((file) => file === undefined)) {
    problems.push('a link graph needs linkCount, linksChecksum and linkMatchesChecksum in the manifest and both files');
    return null;
  }
  const linksJsonl = files.linksJsonl as Uint8Array;
  const linkMatchesJsonl = files.linkMatchesJsonl as Uint8Array;
  if (computeChecksum(linksJsonl) !== manifest.linksChecksum) {
    problems.push('links.jsonl does not match the manifest linksChecksum');
  }
  if (computeChecksum(linkMatchesJsonl) !== manifest.linkMatchesChecksum) {
    problems.push('link-matches.jsonl does not match the manifest linkMatchesChecksum');
  }
  const links = parseLines(linksJsonl, 'links.jsonl', linkLineSchema, problems);
  const matches = parseLines(linkMatchesJsonl, 'link-matches.jsonl', linkMatchLineSchema, problems);
  if (links.length !== manifest.linkCount) {
    problems.push(`the manifest says ${manifest.linkCount} links but links.jsonl has ${links.length} lines`);
  }
  for (const key of findRepeatedValues(matches.map((match) => match.key))) {
    problems.push(`link-matches.jsonl: ${key} appears more than once`);
  }
  return { links, matches };
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

  const linkGraph = parseLinkGraph(files, manifest, problems);

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
  return { manifest, questions, catalog, linkGraph };
}
