import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { GameType } from '@modules/question-bank';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { BattleEngine, NoPlayableContentError } from './battle-engine';
import { BATTLE_SETTINGS, type BattleSettings, findRevealGameSettings } from './battle-settings';
import { ACTIVITY_GUARD, type Activity, type ActivityGuard } from './ports/activity-guard';
import { BATTLE_NOTIFIER, type BattleNotifier } from './ports/battle-notifier';
import { type ScheduledTimer, TIMER_SCHEDULER, type TimerScheduler } from './ports/timer-scheduler';

interface Ticket {
  ticketId: string;
  activity: Activity;
  fallback: ScheduledTimer;
}

/**
 * Joining a battle queue (03 §3). P6.1 has no human pairing yet: every ticket gets a bot after
 * `botFallbackAfterMs` (DEC-39). P6.3 replaces the in-memory tickets with the Redis queue and matcher.
 *
 * `join` is the one entry point where a play-access check will go when membership exists (ADR-0016).
 */
@Injectable()
export class MatchmakingService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly tickets = new Map<string, Ticket>();

  constructor(
    private readonly engine: BattleEngine,
    @Inject(ACTIVITY_GUARD) private readonly activities: ActivityGuard,
    @Inject(BATTLE_NOTIFIER) private readonly notifier: BattleNotifier,
    @Inject(TIMER_SCHEDULER) private readonly timers: TimerScheduler,
    @Inject(BATTLE_SETTINGS) private readonly settings: BattleSettings,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Tickets live in this process only, so a crash leaves players marked as queued: free them. In the
   * background, so the boot never waits for Redis.
   */
  onApplicationBootstrap(): void {
    this.activities
      .releaseEveryQueueActivity()
      .then((released) => {
        if (released > 0) this.logger.warn(`Released ${String(released)} queue tickets left by a previous process`);
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Could not release old queue tickets: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  /** Before Redis closes: queued players are dropped with the process and must be free to join again. */
  async beforeApplicationShutdown(): Promise<void> {
    const tickets = [...this.tickets.entries()];
    this.tickets.clear();
    for (const [userId, ticket] of tickets) {
      ticket.fallback.cancel();
      // Redis may already be gone; the key then expires on its own, and the next boot clears it anyway.
      await this.activities.releaseActivity(userId, ticket.activity).catch(() => undefined);
    }
  }

  /** Returns an error code for the ack, or null when the player is queued. */
  async join(userId: string, gameType: GameType): Promise<string | null> {
    if (!findRevealGameSettings(this.settings, gameType)?.enabled) return 'GAME_TYPE_UNAVAILABLE';
    const ticketId = this.ids.next();
    const activity: Activity = `QUEUE:${ticketId}`;
    if (!(await this.activities.claimActivity(userId, activity))) return 'PLAYER_BUSY';

    const queuedAt = this.clock.now();
    const botFallbackAt = new Date(queuedAt.getTime() + this.settings.matchmaking.botFallbackAfterMs);
    const fallback = this.timers.runAt(botFallbackAt, () => void this.startBotBattle(userId, gameType, ticketId));
    this.tickets.set(userId, { ticketId, activity, fallback });
    this.notifier.sendToUser(userId, 'matchmaking:queued', {
      type: 'matchmaking:queued',
      serverTime: queuedAt.toISOString(),
      data: { ticketId, queuedAt: queuedAt.toISOString(), botFallbackAt: botFallbackAt.toISOString() },
    });
    return null;
  }

  /** A no-op when the player is not queued. */
  async leave(userId: string): Promise<void> {
    const ticket = this.tickets.get(userId);
    if (!ticket) return;
    this.tickets.delete(userId);
    ticket.fallback.cancel();
    await this.activities.releaseActivity(userId, ticket.activity);
  }

  private async startBotBattle(userId: string, gameType: GameType, ticketId: string): Promise<void> {
    const ticket = this.tickets.get(userId);
    if (ticket?.ticketId !== ticketId) return;
    this.tickets.delete(userId);
    try {
      await this.engine.createBotBattle(userId, gameType, ticket.activity);
    } catch (error) {
      await this.activities.releaseActivity(userId, ticket.activity);
      const code = error instanceof NoPlayableContentError ? 'NO_CONTENT' : 'SERVER_ERROR';
      if (code === 'SERVER_ERROR') this.logger.error(error instanceof Error ? (error.stack ?? error.message) : error);
      this.notifier.sendToUser(userId, 'error', {
        type: 'error',
        serverTime: this.clock.now().toISOString(),
        data: { code, message: 'No battle could be started' },
      });
    }
  }
}
