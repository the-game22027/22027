import type { GameType } from '@modules/question-bank';
import type { Locale } from '@shared/kernel';

export const MATCHMAKING_QUEUE = Symbol('MATCHMAKING_QUEUE');

export interface QueueTicket {
  ticketId: string;
  userId: string;
  gameType: GameType;
  locale: Locale;
  queuedAt: Date;
}

/**
 * One queue per game type, oldest first (03 §3.3). Every removal is atomic, so a ticket is matched,
 * given a bot, or left exactly once.
 */
export interface MatchmakingQueue {
  addTicket(ticket: QueueTicket): Promise<void>;
  /** False when the ticket was already taken by the matcher or the bot fallback. */
  removeTicket(gameType: GameType, ticketId: string): Promise<boolean>;
  /** Up to `max` of the oldest tickets, oldest first, left in the queue. */
  peekOldestTickets(gameType: GameType, max: number): Promise<QueueTicket[]>;
  /** Both tickets, removed together, only if both are still queued; otherwise nothing is removed and it is empty. */
  takeTicketPair(gameType: GameType, ticketIds: readonly [string, string]): Promise<QueueTicket[]>;
  /** Every ticket queued at or before `cutoff`, removed (they get a bot). */
  takeTicketsQueuedBefore(gameType: GameType, cutoff: Date): Promise<QueueTicket[]>;
  findTicket(ticketId: string): Promise<QueueTicket | null>;
  /** Single instance only: after a restart, queued players have no socket and no timer any more. */
  removeEveryTicket(): Promise<number>;
}
