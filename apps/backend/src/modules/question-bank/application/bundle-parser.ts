import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type Locale, LOCALES } from '@shared/kernel';
import { InvalidBundleError } from '../domain/question-bank-errors';
import type { BundleQuestion } from '../domain/question-content';
import { findQuestionProblems, findRepeatedValues } from '../domain/question-rules';

const nonEmpty = z.string().trim().min(1);
const locale = z.enum(LOCALES);

const manifestSchema = z.strictObject({
  bundleVersion: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/, 'use 1-64 letters, digits, dots, dashes or underscores'),
  kbVersion: nonEmpty,
  generatorVersion: nonEmpty,
  questionCount: z.number().int().nonnegative(),
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/, 'expected sha256:<64 hex characters>'),
  categories: z.array(
    z.strictObject({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined by dashes'),
      names: z.strictObject({ en: nonEmpty, ar: nonEmpty.optional() }),
    }),
  ),
});

const lineSchema = z.strictObject({
  externalKey: z.string().min(1).max(200),
  type: z.literal('SINGLE_CHOICE'),
  category: z.string(),
  difficulty: z.number(),
  locales: z.partialRecord(locale, z.strictObject({ text: z.string(), explanation: z.string().nullish() })),
  options: z.array(
    z.strictObject({
      position: z.number().int(),
      isCorrect: z.boolean(),
      entityRef: nonEmpty.nullish(),
      locales: z.partialRecord(locale, z.string()),
    }),
  ),
  provenance: z.strictObject({
    facts: z.array(nonEmpty),
    sources: z.array(nonEmpty),
    licenses: z.array(nonEmpty),
    kbVersion: nonEmpty,
  }),
  validUntil: z.iso.datetime({ offset: true }).nullish(),
  humanReviewed: z.partialRecord(locale, z.boolean()).optional(),
});

export type BundleManifest = z.infer<typeof manifestSchema>;

export interface BundleFiles {
  manifestJson: string;
  /** Raw bytes, because the manifest checksum is over the exact file content. */
  questionsJsonl: Uint8Array;
}

export interface ParsedBundle {
  manifest: BundleManifest;
  questions: BundleQuestion[];
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

const toBundleQuestion = (line: z.infer<typeof lineSchema>): BundleQuestion => ({
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
  reviewedLocales: (Object.entries(line.humanReviewed ?? {}) as [Locale, boolean][])
    .filter(([, reviewed]) => reviewed)
    .map(([reviewedLocale]) => reviewedLocale)
    .sort(),
});

export function computeChecksum(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/** Reads and checks a whole bundle. Throws InvalidBundleError listing every problem it found. */
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
  const slugs = manifest.categories.map((category) => category.slug);
  for (const slug of findRepeatedValues(slugs)) problems.push(`manifest.json: category "${slug}" is listed twice`);

  const knownCategories = new Set(slugs);
  const lines = Buffer.from(files.questionsJsonl).toString('utf8').split('\n');
  if (lines.at(-1) === '') lines.pop();
  const questions: BundleQuestion[] = [];
  lines.forEach((text, index) => {
    const where = `line ${index + 1}`;
    const json = parseJson(text);
    if ('error' in json) return void problems.push(`${where}: ${json.error}`);
    const result = lineSchema.safeParse(json.value);
    if (!result.success)
      return void problems.push(...describeIssues(result.error).map((issue) => `${where}: ${issue}`));
    const question = toBundleQuestion(result.data);
    problems.push(...findQuestionProblems(question, knownCategories).map((problem) => `${where}: ${problem}`));
    questions.push(question);
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
  return { manifest, questions };
}
