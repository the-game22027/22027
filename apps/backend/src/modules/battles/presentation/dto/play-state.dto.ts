import { IsIn } from 'class-validator';
import { GAME_TYPES, type GameType } from '@modules/question-bank';

export class JoinMatchmakingDto {
  @IsIn(GAME_TYPES)
  gameType!: GameType;
}

export class MatchmakingTicketDto {
  ticketId!: string;
  gameType!: GameType;
  status!: 'QUEUED';
  queuedAt!: string;
  botFallbackAt!: string | null;
}

export class PlayStateBattleDto {
  battleId!: string;
  status!: string;
}

/** What the player is doing right now, so the app can resume after a restart (API.md §5). */
export class PlayStateDto {
  queue!: MatchmakingTicketDto | null;
  /** Rooms come with P8. */
  room!: null;
  battle!: PlayStateBattleDto | null;
  serverTime!: string;
}
