import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
  // A bare `null` type gives the Swagger plugin nothing to describe, and the document fails at boot.
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Rooms come with P8: always null for now.',
  })
  room!: null;
  battle!: PlayStateBattleDto | null;
  serverTime!: string;
}
