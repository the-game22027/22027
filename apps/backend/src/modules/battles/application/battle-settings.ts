import type { TypedAnswerRules } from '@modules/question-bank';
import type { BotProfile } from '../domain/bots/reveal-and-buzz-bot';
import type { GridConfig } from '../domain/games/grid-rules';
import type { RevealAndBuzzConfig } from '../domain/games/reveal-and-buzz-rules';

export const BATTLE_SETTINGS = Symbol('BATTLE_SETTINGS');

/** Game types played with the reveal-and-buzz rules (08 §3.1). */
export type RevealGameType = 'BUZZER' | 'CAREER' | 'WHO_IS_PLAYER';

interface CommonGameSettings {
  enabled: boolean;
  roundCount: number;
  /** DEC-44: content of a player's last `excludeLastBattles` battles is skipped while the bank allows it. */
  selection: { difficulties: number[] | null; excludeLastBattles: number };
}

/** The `GRID` section of the battle config (08 §6). */
export interface GridGameSettings extends CommonGameSettings, Omit<GridConfig, 'latencyGraceMs'> {
  /** Content is picked only when every cell has at least this many valid players. */
  minAnswersPerCell: number;
  /** Show one valid player per empty cell when the round ends. */
  revealAnswersAtEnd: boolean;
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
  gameTypes: Partial<Record<RevealGameType, RevealGameSettings>> & { GRID?: GridGameSettings };
}

export type GameSettings = RevealGameSettings | GridGameSettings;

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
}
