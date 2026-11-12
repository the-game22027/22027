import type { Locale } from '@shared/kernel';
import type { BotProfile } from '../domain/bots/reveal-and-buzz-bot';
import type { ParticipantId } from '../domain/games/game-rules';

/** A participant of a running battle, as the engine and the round runners see it. */
export interface LiveParticipant {
  id: ParticipantId;
  kind: 'HUMAN' | 'BOT';
  userId: string | null;
  locale: Locale;
  seat: number;
  /** Public profile for humans, display names for bots (DEC-40: bots are always labeled). */
  user: { id: string; displayName: string; username: string | null; avatarUrl: string | null } | null;
  bot: { profileKey: string; profile: BotProfile } | null;
  ready: boolean;
  /** The socket that sent battle:ready or, later, battle:resync; only it may buzz and answer (WEBSOCKET.md §1). */
  activeSocketId: string | null;
  connected: boolean;
  /** Left for good: forfeit, grace expired, or not ready in time. */
  forfeited: boolean;
}
