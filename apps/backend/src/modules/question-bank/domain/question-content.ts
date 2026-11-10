import { createHash } from 'node:crypto';
import type { Locale } from '@shared/kernel';

export interface LocalizedQuestionText {
  text: string;
  explanation: string | null;
}

export interface OptionContent {
  position: number;
  isCorrect: boolean;
  entityRef: string | null;
  locales: Partial<Record<Locale, string>>;
}

/** What a player sees and what decides correctness. Changing any of it changes the content hash. */
export interface QuestionContent {
  type: 'SINGLE_CHOICE';
  category: string;
  difficulty: number;
  locales: Partial<Record<Locale, LocalizedQuestionText>>;
  options: OptionContent[];
  validUntil: Date | null;
}

export interface Provenance {
  facts: string[];
  sources: string[];
  licenses: string[];
  kbVersion: string;
}

/** One question of a bundle, after its line was parsed. */
export interface BundleQuestion {
  externalKey: string;
  content: QuestionContent;
  provenance: Provenance;
  reviewedLocales: Locale[];
}

export function localesOfQuestion(content: QuestionContent): Locale[] {
  return (Object.keys(content.locales) as Locale[]).sort();
}

/** JSON with object keys sorted at every level, so the same content always gives the same text. */
function toCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toCanonicalJson).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${toCanonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeContentHash(content: QuestionContent): string {
  const options = [...content.options].sort((a, b) => a.position - b.position);
  const canonical = toCanonicalJson({ ...content, options });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
