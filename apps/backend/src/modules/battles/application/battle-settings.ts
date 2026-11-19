import type { TypedAnswerRules } from '@modules/question-bank';
import type { LeaderboardPointsRule } from '../domain/leaderboard-points';
import type { BotProfile } from '../domain/bots/reveal-and-buzz-bot';
import type { FirstMoverAfterRound1, FirstMoverMethod } from '../domain/first-mover/next-first-mover';
import type { GridConfig } from '../domain/games/grid-rules';
import type { RevealAndBuzzConfig } from '../domain/games/reveal-and-buzz-rules';

export const BATTLE_SETTINGS = Symbol('BATTLE_SETTINGS');

/** Game types played with the reveal-and-buzz rules (08 §3.1). */
export type RevealGameType = 'BUZZER' | 'CAREER' | 'WHO_IS_PLAYER';

/** Who moves first (08 §9.1, ADR-0023). */
export interface FirstMoverSettings {
  firstMover: FirstMoverMethod;
  /** DEC-71: who starts rounds 2+. Required unless `firstMover` is NONE. */
  firstMoverAfterRound1?: FirstMoverAfterRound1;
  /** Required when `firstMover` is RPS. `revealMs`: how long a result shows before the next attempt or round. */
  rps?: { pickMs: number; maxReplays: number; revealMs: number; botPickDelayMs: { min: number; max: number } };
}

interface CommonGameSettings extends FirstMoverSettings {
  enabled: boolean;
  roundCount: number;
  /** null = any difficulty. Seen questions are skipped by the engine, not by config (DEC-44). */
  selection: { difficulties: number[] | null };
  /** The battle ends as soon as a score reaches this (08 §11.7); `roundCount` is then only the most rounds. */
  targetScore?: number | null;
}

/** The `GRID` section of the battle config (08 §6). */
export interface GridGameSettings extends CommonGameSettings, Omit<GridConfig, 'latencyGraceMs'> {
  /** Content is picked only when every cell has at least this many valid players. */
  minAnswersPerCell: number;
  /** Show one valid player per empty cell when the round ends. */
  revealAnswersAtEnd: boolean;
}

/** The `MINES` section of the battle config (08 §10.6). */
export interface MinesGameSettings extends CommonGameSettings {
  burying: { minesPerPlayer: number; ms: number; maxWrongTries: number };
  turnMs: number;
  maxTurns: number;
  hearts: number;
  /** DEC-72. */
  ownMine: 'REJECT' | 'COSTS_HEART';
  /** DEC-75: uses per player for the whole battle, and the turn time one use costs. */
  detector: { usesPerBattle: number; costMs: number };
  /** How many unsaid players of the category the round result shows. */
  revealAnswersAtEnd: number;
  showWrongAnswers: boolean;
  points: { roundWin: number; roundDraw: number; perSafeAnswer: number };
}

/** The `AUCTION` section of the battle config (08 §11.6). */
export interface AuctionGameSettings extends CommonGameSettings {
  pickMs: number;
  /** DEC-76: `minOpeningBid`. */
  bidding: { turnMs: number; minOpeningBid: number };
  proof: { ms: number; maxWrong: number };
  /** DEC-77. */
  allIn: { maxWrong: number };
  /** DEC-76: `names`. */
  steal: { ms: number; names: number };
  showWrongAnswers: boolean;
  points: { roundWin: number; allInWin: number };
}

/** The `HEX` section of the battle config (08 §13.7). The board size comes with the content. */
export interface HexGameSettings extends CommonGameSettings {
  pickMs: number;
  answerMs: number;
  lockoutMs: number[];
  clear: { usesPerBattle: number };
  /** DEC-79. */
  maxPicks: number;
  showWrongAnswers: boolean;
  points: { boardWin: number };
}

/** The `VAULT` section of the battle config (08 §12.6). The code has one digit per question of the content. */
export interface VaultGameSettings extends CommonGameSettings {
  roundMs: number;
  lockoutMs: number[];
  /** DEC-78. */
  leaks: { firstAtMs: number; everyMs: number; max: number };
  points: { vaultOpened: number };
}

/** The `LINEUP` section of the battle config (08 §14.6). The XI and the shown names come with the content. */
export interface LineupGameSettings extends CommonGameSettings {
  roundMs: number;
  /** DEC-80. */
  lockoutMs: number[];
  hints: { firstAtMs: number; everyMs: number; max: number };
  /** DEC-80. */
  accuse: { perPlayer: number };
  showWrongAnswers: boolean;
  points: { correct: number; captain: number; accuseRight: number; accuseWrong: number };
}

/** One reveal-and-buzz game type's section of the battle config (08 §6). */
export interface RevealGameSettings extends CommonGameSettings, Omit<RevealAndBuzzConfig, 'latencyGraceMs'> {
  /** CAREER only: show the years of each spell (08 §3.1). */
  showYears?: boolean;
}

/** The battle config file (ADR-0018), validated at boot. Every value is configuration, most are still open. */
export interface BattleSettings {
  /** True for placeholder values; production refuses to start with them. */
  devOnly: boolean;
  engine: { readyTimeoutMs: number; latencyGraceMs: number; betweenRoundsMs: number; reconnectGraceMs: number };
  /** How often the matcher pairs tickets, and how long a disconnected player keeps their ticket (03 §3.3). */
  matchmaking: { botFallbackAfterMs: number; tickMs: number; queueDisconnectGraceMs: number };
  bots: { profiles: Record<string, BotProfile> };
  /** How typed text is judged, for every game type (08 §5.3, DEC-55). */
  answers: TypedAnswerRules;
  gameTypes: Partial<Record<RevealGameType, RevealGameSettings>> & {
    GRID?: GridGameSettings;
    MINES?: MinesGameSettings;
    AUCTION?: AuctionGameSettings;
    VAULT?: VaultGameSettings;
    HEX?: HexGameSettings;
    LINEUP?: LineupGameSettings;
  };
}

export type GameSettings =
  | RevealGameSettings
  | GridGameSettings
  | MinesGameSettings
  | AuctionGameSettings
  | VaultGameSettings
  | HexGameSettings
  | LineupGameSettings;

/** The config of a game type, or undefined when it has none. */
export function findGameSettings(settings: BattleSettings, gameType: string): GameSettings | undefined {
  return (settings.gameTypes as Partial<Record<string, GameSettings>>)[gameType];
}

/** The part of the settings a battle keeps for its whole life (battles.config). */
export interface BattleConfigSnapshot {
  game: GameSettings;
  engine: BattleSettings['engine'];
  answers: TypedAnswerRules;
  botProfile: string | null;
  /** Seeds the bot's random source, so a bot battle replays identically. */
  seed: number;
  /** This battle's mode section of the BATTLE rule set active at creation; null when none was (08 §6.1). */
  leaderboardPoints: { ruleSetId: string; rule: LeaderboardPointsRule } | null;
}
