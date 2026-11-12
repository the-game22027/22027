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

/** Unknown, or never served to this player: the same answer for both, so ids cannot be probed (08 §5.7). */
export class ServedQuestionNotFoundError extends DomainError {
  readonly code = 'QUESTION_NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor() {
    super('You were not served this question in a battle.');
  }
}
