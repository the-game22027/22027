import { createHash } from 'node:crypto';
import { type Locale, LOCALES } from '@shared/kernel';

export const GAME_TYPES = ['BUZZER', 'CAREER', 'WHO_IS_PLAYER', 'GRID'] as const;
export type GameType = (typeof GAME_TYPES)[number];

/** Kinds of answer catalog entities (08 §5). */
export const ENTITY_KINDS = ['PLAYER', 'CLUB', 'NATIONAL_TEAM', 'COUNTRY', 'COMPETITION', 'COACH'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** What a typed answer must be (08 §4). `NUMBER` answers are numbers, every other kind is a catalog entity. */
export const ANSWER_KINDS = [...ENTITY_KINDS, 'NUMBER'] as const;
export type AnswerKind = (typeof ANSWER_KINDS)[number];

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

/** Legacy multiple choice (P5.1). Still importable, never served by a game (ADR-0015). */
export interface SingleChoiceContent {
  type: 'SINGLE_CHOICE';
  category: string;
  difficulty: number;
  locales: Partial<Record<Locale, LocalizedQuestionText>>;
  options: OptionContent[];
  validUntil: Date | null;
}

export type LocalizedText = Partial<Record<Locale, string>>;

export interface GridCriterion {
  kind: 'CLUB' | 'NATIONALITY' | 'COMPETITION_WON';
  entity: string;
}

/** The game-specific part of a round (08 §4). Entities are referenced by catalog `externalRef`. */
export type GameBody =
  | {
      gameType: 'BUZZER';
      answerKind: AnswerKind;
      steps: Partial<Record<Locale, string[]>>;
      explanation: LocalizedText | null;
      answerNumber: number | null;
    }
  | {
      gameType: 'CAREER';
      player: string;
      spells: { club: string; fromYear: number; toYear: number | null; loan: boolean }[];
    }
  | { gameType: 'WHO_IS_PLAYER'; player: string; clues: { kind: string; text: LocalizedText }[] }
  | { gameType: 'GRID'; rows: GridCriterion[]; cols: GridCriterion[] };

/** Accepted answers of one slot: slot 0 for reveal games, 0..8 for grid cells (row * 3 + col). */
export interface AnswerSlot {
  slot: number;
  entities: string[];
}

/** One round of a game type. Everything here is what players see or what decides correctness. */
export interface GameContent {
  type: 'GAME';
  category: string;
  difficulty: number;
  body: GameBody;
  answers: AnswerSlot[];
  validUntil: Date | null;
}

export type QuestionContent = SingleChoiceContent | GameContent;

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

/**
 * The locales a question can be played in. Career and grid text is built from catalog names,
 * which always exist in every locale, so those games are available in all of them.
 */
export function localesOfQuestion(content: QuestionContent): Locale[] {
  if (content.type === 'SINGLE_CHOICE') return (Object.keys(content.locales) as Locale[]).sort();
  const { body } = content;
  switch (body.gameType) {
    case 'BUZZER':
      return (Object.keys(body.steps) as Locale[]).sort();
    case 'WHO_IS_PLAYER':
      return (Object.keys(body.clues[0]?.text ?? {}) as Locale[]).sort();
    case 'CAREER':
    case 'GRID':
      return [...LOCALES].sort();
  }
}

/**
 * Plain text of a round in one locale, for moderation and reports. Career and grid rounds are built
 * from catalog names at play time, so they have no text of their own.
 */
export function summaryTextOfQuestion(content: QuestionContent, locale: Locale): string {
  if (content.type === 'SINGLE_CHOICE') return content.locales[locale]?.text ?? '';
  const { body } = content;
  switch (body.gameType) {
    case 'BUZZER':
      return (body.steps[locale] ?? []).join(' ');
    case 'WHO_IS_PLAYER':
      return body.clues.map((clue) => clue.text[locale] ?? '').join(' · ');
    case 'CAREER':
    case 'GRID':
      return '';
  }
}

/** What kind of entity (or a number) answers this round. */
export function answerKindOfGame(body: GameBody): AnswerKind {
  return body.gameType === 'BUZZER' ? body.answerKind : 'PLAYER';
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

/** Orders the parts whose order carries no meaning, so reordering them is not a content change. */
function withMeaninglessOrderRemoved(content: QuestionContent): QuestionContent {
  if (content.type === 'SINGLE_CHOICE') {
    return { ...content, options: [...content.options].sort((a, b) => a.position - b.position) };
  }
  const answers = [...content.answers]
    .sort((a, b) => a.slot - b.slot)
    .map((slot) => ({ slot: slot.slot, entities: [...slot.entities].sort() }));
  return { ...content, answers };
}

export function computeContentHash(content: QuestionContent): string {
  const canonical = toCanonicalJson(withMeaninglessOrderRemoved(content));
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
