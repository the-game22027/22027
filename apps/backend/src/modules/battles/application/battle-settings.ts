import type { BotProfile } from '../domain/bots/reveal-and-buzz-bot';
import type { RevealAndBuzzConfig } from '../domain/games/reveal-and-buzz-rules';

export const BATTLE_SETTINGS = Symbol('BATTLE_SETTINGS');

/** Game types played with the reveal-and-buzz rules (08 §3.1). */
export type RevealGameType = 'BUZZER' | 'CAREER' | 'WHO_IS_PLAYER';

/** One reveal-and-buzz game type's section of the battle config (08 §6). */
export interface RevealGameSettings extends Omit<RevealAndBuzzConfig, 'latencyGraceMs'> {
  enabled: boolean;
  roundCount: number;
  /** CAREER only: show the years of each spell (08 §3.1). */
  showYears?: boolean;
  /** DEC-44: content of a player's last `excludeLastBattles` battles is skipped while the bank allows it. */
  selection: { difficulties: number[] | null; excludeLastBattles: number };
}

/** The battle config file (ADR-0017), validated at boot. Every value is configuration, most are still open. */
export interface BattleSettings {
  /** True for placeholder values; production refuses to start with them. */
  devOnly: boolean;
  engine: { readyTimeoutMs: number; latencyGraceMs: number; betweenRoundsMs: number };
  matchmaking: { botFallbackAfterMs: number };
  bots: { profiles: Record<string, BotProfile> };
  gameTypes: Partial<Record<RevealGameType, RevealGameSettings>>;
}

/** The config of a game type, or undefined when it has none (not configured, or not a reveal game yet). */
export function findRevealGameSettings(settings: BattleSettings, gameType: string): RevealGameSettings | undefined {
  return (settings.gameTypes as Partial<Record<string, RevealGameSettings>>)[gameType];
}

/** The part of the settings a battle keeps for its whole life (battles.config). */
export interface BattleConfigSnapshot {
  game: RevealGameSettings;
  engine: BattleSettings['engine'];
  botProfile: string | null;
  /** Seeds the bot's random source, so a bot battle replays identically. */
  seed: number;
}
