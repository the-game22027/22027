import { createHash } from 'node:crypto';
import { type Locale, LOCALES } from '@shared/kernel';

export const GAME_TYPES = [
  'BUZZER',
  'CAREER',
  'WHO_IS_PLAYER',
  'GRID',
  'MINES',
  'AUCTION',
  'VAULT',
  'HEX',
  'LINEUP',
] as const;
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

/** A MINES category: a club plus a citizenship or a decade (08 §10.4). */
export type MinesCriterion = { kind: 'CLUB' | 'NATIONALITY'; entity: string } | { kind: 'DECADE'; fromYear: number };

/** One AUCTION list (08 §11.4): its kind and its title, written by the pipeline in each locale. */
export interface AuctionList {
  kind: string;
  title: LocalizedText;
}

/** One VAULT question (08 §12.4): its template, its text in each locale, and its digit. */
export interface VaultQuestion {
  template: string;
  text: LocalizedText;
  answerNumber: number;
}

/** One HEX cell (08 §13.5): its letter in each locale and the lists asked behind it, in order. */
export interface HexCell {
  letter: LocalizedText;
  questions: AuctionList[];
}

export const LINEUP_LINES = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type LineupLine = (typeof LINEUP_LINES)[number];

/** One slot of a LINEUP formation (08 §14.4): where it is drawn and who started there. */
export interface LineupSlot {
  line: LineupLine;
  /** A role code the app translates (`CB`, `LW`), or null when the source only knows the line. */
  role: string | null;
  shirtNumber: number | null;
  captain: boolean;
  player: string;
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
  | { gameType: 'GRID'; rows: GridCriterion[]; cols: GridCriterion[] }
  | { gameType: 'MINES'; criteria: MinesCriterion[] }
  | { gameType: 'AUCTION'; lists: AuctionList[] }
  | { gameType: 'VAULT'; questions: VaultQuestion[] }
  | { gameType: 'HEX'; size: number; cells: HexCell[] }
  | { gameType: 'LINEUP'; title: LocalizedText; slots: LineupSlot[]; shown: string[]; fake: string };

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
 * which always exist in every locale, so those games (and mines) are available in all of them.
 */
export function localesOfQuestion(content: QuestionContent): Locale[] {
  if (content.type === 'SINGLE_CHOICE') return (Object.keys(content.locales) as Locale[]).sort();
  const { body } = content;
  switch (body.gameType) {
    case 'BUZZER':
      return (Object.keys(body.steps) as Locale[]).sort();
    case 'WHO_IS_PLAYER':
      return (Object.keys(body.clues[0]?.text ?? {}) as Locale[]).sort();
    case 'AUCTION':
      return LOCALES.filter((locale) => body.lists.every((list) => list.title[locale] !== undefined)).sort();
    case 'VAULT':
      return LOCALES.filter((locale) => body.questions.every((question) => question.text[locale] !== undefined)).sort();
    case 'LINEUP':
      return LOCALES.filter((locale) => body.title[locale] !== undefined).sort();
    case 'HEX':
      return LOCALES.filter((locale) =>
        body.cells.every(
          (cell) =>
            cell.letter[locale] !== undefined &&
            cell.questions.every((question) => question.title[locale] !== undefined),
        ),
      ).sort();
    case 'CAREER':
    case 'GRID':
    case 'MINES':
      return [...LOCALES].sort();
  }
}

/**
 * Plain text of a round in one locale, for moderation and reports. Career, grid and mines rounds are built
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
    case 'AUCTION':
      return body.lists.map((list) => list.title[locale] ?? '').join(' · ');
    case 'VAULT':
      return body.questions.map((question) => question.text[locale] ?? '').join(' · ');
    case 'HEX':
      return body.cells.map((cell) => cell.letter[locale] ?? '').join(' ');
    case 'LINEUP':
      return body.title[locale] ?? '';
    case 'CAREER':
    case 'GRID':
    case 'MINES':
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
