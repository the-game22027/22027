import type { Locale } from '@shared/kernel';
import type { AnswerKind, GameBody, GameType, GridCriterion, LocalizedText, MinesCriterion } from './question-content';

export interface EngineGridCriterion {
  kind: GridCriterion['kind'];
  entityId: string;
}

export type EngineMinesCriterion =
  { kind: 'CLUB' | 'NATIONALITY'; entityId: string } | { kind: 'DECADE'; fromYear: number };

/** A round's game-specific part as the engine reads it: catalog references are entity ids (08 §5.4). */
export type EngineGameBody =
  | {
      gameType: 'BUZZER';
      answerKind: AnswerKind;
      steps: Partial<Record<Locale, string[]>>;
      explanation: LocalizedText | null;
      answerNumber: number | null;
    }
  | {
      gameType: 'CAREER';
      playerEntityId: string;
      spells: { clubEntityId: string; fromYear: number; toYear: number | null; loan: boolean }[];
    }
  | { gameType: 'WHO_IS_PLAYER'; playerEntityId: string; clues: { kind: string; text: LocalizedText }[] }
  | { gameType: 'GRID'; rows: EngineGridCriterion[]; cols: EngineGridCriterion[] }
  | { gameType: 'MINES'; criteria: EngineMinesCriterion[] }
  | { gameType: 'AUCTION'; lists: { kind: string; title: LocalizedText }[] }
  | { gameType: 'VAULT'; questions: { template: string; text: LocalizedText; answerNumber: number }[] }
  | {
      gameType: 'HEX';
      size: number;
      cells: { letter: LocalizedText; questions: { kind: string; title: LocalizedText }[] }[];
    };

/** Everything the engine needs to play one round. Server side only: never sent to a client as is. */
export interface EngineContent {
  contentId: string;
  gameType: GameType;
  answerKind: AnswerKind;
  difficulty: number;
  body: EngineGameBody;
  /** Accepted answers per slot, for the reveal at the end of a round. Correctness goes through AnswerChecker. */
  acceptedAnswers: { slot: number; entityIds: string[] }[];
}

/** Every catalog reference a body points at, so they can be looked up in one query. */
export function listEntityReferencesOfBody(body: GameBody): string[] {
  switch (body.gameType) {
    case 'BUZZER':
    case 'AUCTION':
    case 'VAULT':
    case 'HEX':
      return [];
    case 'CAREER':
      return [body.player, ...body.spells.map((spell) => spell.club)];
    case 'WHO_IS_PLAYER':
      return [body.player];
    case 'GRID':
      return [...body.rows, ...body.cols].map((criterion) => criterion.entity);
    case 'MINES':
      return body.criteria.flatMap((criterion) => ('entity' in criterion ? [criterion.entity] : []));
  }
}

const keepLocales = <T>(
  byLocale: Partial<Record<Locale, T>>,
  locales: readonly Locale[],
): Partial<Record<Locale, T>> => {
  const kept: Partial<Record<Locale, T>> = {};
  for (const locale of locales) {
    const value = byLocale[locale];
    if (value === undefined) throw new Error(`The content has no text in locale ${locale}`);
    kept[locale] = value;
  }
  return kept;
};

/**
 * Builds the engine's view of a stored body: references become entity ids and texts are kept only in
 * the battle's locales. A missing reference or locale is a broken invariant (import and selection check both).
 */
export function toEngineBody(
  body: GameBody,
  entityIdOfReference: (externalRef: string) => string | undefined,
  locales: readonly Locale[],
): EngineGameBody {
  const idOf = (externalRef: string): string => {
    const id = entityIdOfReference(externalRef);
    if (id === undefined) throw new Error(`The content points at ${externalRef}, which is not in the catalog`);
    return id;
  };
  switch (body.gameType) {
    case 'BUZZER':
      return {
        gameType: 'BUZZER',
        answerKind: body.answerKind,
        steps: keepLocales(body.steps, locales),
        explanation: body.explanation === null ? null : pickAvailableLocales(body.explanation, locales),
        answerNumber: body.answerNumber,
      };
    case 'CAREER':
      return {
        gameType: 'CAREER',
        playerEntityId: idOf(body.player),
        spells: body.spells.map(({ club, ...spell }) => ({ clubEntityId: idOf(club), ...spell })),
      };
    case 'WHO_IS_PLAYER':
      return {
        gameType: 'WHO_IS_PLAYER',
        playerEntityId: idOf(body.player),
        clues: body.clues.map((clue) => ({ kind: clue.kind, text: keepLocales(clue.text, locales) })),
      };
    case 'GRID': {
      const criterionOf = (criterion: GridCriterion): EngineGridCriterion => ({
        kind: criterion.kind,
        entityId: idOf(criterion.entity),
      });
      return { gameType: 'GRID', rows: body.rows.map(criterionOf), cols: body.cols.map(criterionOf) };
    }
    case 'AUCTION':
      return {
        gameType: 'AUCTION',
        lists: body.lists.map((list) => ({ kind: list.kind, title: keepLocales(list.title, locales) })),
      };
    case 'HEX':
      return {
        gameType: 'HEX',
        size: body.size,
        cells: body.cells.map((cell) => ({
          letter: keepLocales(cell.letter, locales),
          questions: cell.questions.map((question) => ({
            kind: question.kind,
            title: keepLocales(question.title, locales),
          })),
        })),
      };
    case 'VAULT':
      return {
        gameType: 'VAULT',
        questions: body.questions.map((question) => ({ ...question, text: keepLocales(question.text, locales) })),
      };
    case 'MINES': {
      const criterionOf = (criterion: MinesCriterion): EngineMinesCriterion =>
        criterion.kind === 'DECADE' ? criterion : { kind: criterion.kind, entityId: idOf(criterion.entity) };
      return { gameType: 'MINES', criteria: body.criteria.map(criterionOf) };
    }
  }
}

// An explanation is optional per locale, so a missing one is left out instead of failing.
function pickAvailableLocales(text: LocalizedText, locales: readonly Locale[]): LocalizedText {
  const kept: LocalizedText = {};
  for (const locale of locales) {
    const value = text[locale];
    if (value !== undefined) kept[locale] = value;
  }
  return kept;
}
