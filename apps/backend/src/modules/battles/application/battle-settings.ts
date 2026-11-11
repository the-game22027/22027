import type { BotProfile } from '../domain/bots/reveal-and-buzz-bot';
import type { RevealAndBuzzConfig } from '../domain/games/reveal-and-buzz-rules';

export const BATTLE_SETTINGS = Symbol('BATTLE_SETTINGS');

/** One reveal-and-buzz game type's section of the battle config (08 §6). */
export interface RevealGameSettings extends Omit<RevealAndBuzzConfig, 'latencyGraceMs'> {
  enabled: boolean;
  roundCount: number;
  selection: { difficulties: number[] | null };
}

/** The battle config file (ADR-0017), validated at boot. Every value is configuration, most are still open. */
export interface BattleSettings {
  /** True for placeholder values; production refuses to start with them. */
  devOnly: boolean;
  engine: { readyTimeoutMs: number; latencyGraceMs: number; betweenRoundsMs: number };
  matchmaking: { botFallbackAfterMs: number };
  bots: { profiles: Record<string, BotProfile> };
  gameTypes: { BUZZER?: RevealGameSettings };
}

/** The part of the settings a battle keeps for its whole life (battles.config). */
export interface BattleConfigSnapshot {
  game: RevealGameSettings;
  engine: BattleSettings['engine'];
  botProfile: string | null;
  /** Seeds the bot's random source, so a bot battle replays identically. */
  seed: number;
}
