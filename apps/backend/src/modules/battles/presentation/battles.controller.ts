import { Body, Controller, Delete, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import { CLOCK, type Clock } from '@shared/kernel';
import { BattleEngine } from '../application/battle-engine';
import { BATTLE_SETTINGS, type BattleSettings } from '../application/battle-settings';
import { MatchmakingService } from '../application/matchmaking.service';
import type { QueueTicket } from '../application/ports/matchmaking-queue';
import { MatchmakingJoinRefusedError } from '../domain/battle-errors';
import { JoinMatchmakingDto, MatchmakingTicketDto, PlayStateDto } from './dto/play-state.dto';

@ApiTags('battles')
@ApiBearerAuth()
@Controller({ version: '1' })
export class BattlesController {
  constructor(
    private readonly matchmaking: MatchmakingService,
    private readonly engine: BattleEngine,
    @Inject(BATTLE_SETTINGS) private readonly settings: BattleSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get('me/play-state')
  async playState(@CurrentUser() auth: AuthContext): Promise<PlayStateDto> {
    const ticket = await this.matchmaking.findQueuedTicket(auth.userId);
    return {
      queue: ticket ? this.ticketDto(ticket) : null,
      room: null,
      battle: this.engine.findLiveBattleIdOfUser(auth.userId),
      serverTime: this.clock.now().toISOString(),
    };
  }

  /** Same as WS `matchmaking:join`; the match itself still arrives on the socket as `battle:found`. */
  @Post('battles/matchmaking')
  async join(@CurrentUser() auth: AuthContext, @Body() body: JoinMatchmakingDto): Promise<MatchmakingTicketDto> {
    const refusal = await this.matchmaking.join(auth.userId, body.gameType);
    if (refusal) throw new MatchmakingJoinRefusedError(refusal);
    const ticket = await this.matchmaking.findQueuedTicket(auth.userId);
    if (!ticket) throw new MatchmakingJoinRefusedError('PLAYER_BUSY');
    return this.ticketDto(ticket);
  }

  @Delete('battles/matchmaking')
  @HttpCode(204)
  async leave(@CurrentUser() auth: AuthContext): Promise<void> {
    await this.matchmaking.leave(auth.userId);
  }

  private ticketDto(ticket: QueueTicket): MatchmakingTicketDto {
    return {
      ticketId: ticket.ticketId,
      gameType: ticket.gameType,
      status: 'QUEUED',
      queuedAt: ticket.queuedAt.toISOString(),
      botFallbackAt: new Date(ticket.queuedAt.getTime() + this.settings.matchmaking.botFallbackAfterMs).toISOString(),
    };
  }
}
