import { DomainError } from '@shared/kernel';

/** A refused matchmaking join over REST; the WebSocket ack carries the same `code` (WEBSOCKET.md §3). */
export class MatchmakingJoinRefusedError extends DomainError {
  readonly kind = 'CONFLICT';

  constructor(readonly code: string) {
    super(
      code === 'PLAYER_BUSY'
        ? 'You are already queued, in a room, or in a battle.'
        : 'This game type cannot be played right now.',
    );
  }
}
