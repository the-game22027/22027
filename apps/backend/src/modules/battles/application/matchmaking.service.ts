import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { GameType } from '@modules/question-bank';
import { UsersFacade } from '@modules/users';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { BattleEngine, NoPlayableContentError } from './battle-engine';
import { BATTLE_SETTINGS, type BattleSettings, findRevealGameSettings, type RevealGameType } from './battle-settings';
import { ACTIVITY_GUARD, type Activity, type ActivityGuard } from './ports/activity-guard';
import { BATTLE_NOTIFIER, type BattleNotifier } from './ports/battle-notifier';
import { MATCHMAKING_QUEUE, type MatchmakingQueue, type QueueTicket } from './ports/matchmaking-queue';
import { type ScheduledTimer, TIMER_SCHEDULER, type TimerScheduler } from './ports/timer-scheduler';

const queueActivity = (ticketId: string): Activity => `QUEUE:${ticketId}`;

/**
 * Random 1v1 matchmaking (03 §3.3): one Redis queue per game type, a matcher that pairs the two oldest
 * tickets every `tickMs`, and a bot for anyone who waited `botFallbackAfterMs` (DEC-39).
 *
 * `join` is the one entry point where a play-access check will go when membership exists (ADR-0016).
 */
@Injectable()
export class MatchmakingService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(MatchmakingService.name);
  private matcherTimer: ScheduledTimer | null = null;
  private stopped = false;
  /** Queued players whose last socket dropped: they lose their ticket unless they come back in time. */
  private readonly ghostTimers = new Map<string, ScheduledTimer>();

  constructor(
    private readonly engine: BattleEngine,
    private readonly users: UsersFacade,
    @Inject(MATCHMAKING_QUEUE) private readonly queue: MatchmakingQueue,
    @Inject(ACTIVITY_GUARD) private readonly activities: ActivityGuard,
    @Inject(BATTLE_NOTIFIER) private readonly notifier: BattleNotifier,
    @Inject(TIMER_SCHEDULER) private readonly timers: TimerScheduler,
    @Inject(BATTLE_SETTINGS) private readonly settings: BattleSettings,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Single instance: queued players of a previous process have no socket and no timer any more, so their
   * tickets and activities go. In the background, so the boot never waits for Redis.
   */
  onApplicationBootstrap(): void {
    void (async () => {
      const tickets = await this.queue.removeEveryTicket();
      const activities = await this.activities.releaseEveryQueueActivity();
      if (tickets + activities > 0) {
        this.logger.warn(`Cleared ${String(activities)} queued players of a previous process`);
      }
      this.scheduleNextMatcherRun();
    })().catch((error: unknown) => {
      this.logger.error(`Matchmaking did not start: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  beforeApplicationShutdown(): void {
    this.stopped = true;
    this.matcherTimer?.cancel();
    for (const timer of this.ghostTimers.values()) timer.cancel();
    this.ghostTimers.clear();
  }

  /** Returns an error code for the ack, or null when the player is queued. */
  async join(userId: string, gameType: GameType): Promise<string | null> {
    if (!findRevealGameSettings(this.settings, gameType)?.enabled) return 'GAME_TYPE_UNAVAILABLE';
    const account = await this.users.getAccount(userId);
    if (!account) return 'NOT_PARTICIPANT';
    const ticket: QueueTicket = {
      ticketId: this.ids.next(),
      userId,
      gameType,
      locale: account.locale,
      queuedAt: this.clock.now(),
    };
    if (!(await this.activities.claimActivity(userId, queueActivity(ticket.ticketId)))) return 'PLAYER_BUSY';
    await this.queue.addTicket(ticket);
    const botFallbackAt = new Date(ticket.queuedAt.getTime() + this.settings.matchmaking.botFallbackAfterMs);
    this.notifier.sendToUser(userId, 'matchmaking:queued', {
      type: 'matchmaking:queued',
      serverTime: ticket.queuedAt.toISOString(),
      data: {
        ticketId: ticket.ticketId,
        gameType,
        queuedAt: ticket.queuedAt.toISOString(),
        botFallbackAt: botFallbackAt.toISOString(),
      },
    });
    return null;
  }

  /**
   * A no-op when the player is not queued. When the matcher took the ticket at the same moment, the
   * player stays in the battle it made (they receive battle:found): the atomic removal decides (03 §3.3).
   */
  async leave(userId: string): Promise<void> {
    const ticket = await this.findQueuedTicket(userId);
    if (!ticket) return;
    if (await this.queue.removeTicket(ticket.gameType, ticket.ticketId)) {
      await this.activities.releaseActivity(userId, queueActivity(ticket.ticketId));
    }
  }

  async findQueuedTicket(userId: string): Promise<QueueTicket | null> {
    const activity = await this.activities.findActivity(userId);
    if (!activity?.startsWith('QUEUE:')) return null;
    return this.queue.findTicket(activity.slice('QUEUE:'.length));
  }

  /** Ghost tickets (03 §3.3 step 6): a queued player with no socket left loses the ticket after a grace. */
  userWentOffline(userId: string): void {
    const at = new Date(this.clock.now().getTime() + this.settings.matchmaking.queueDisconnectGraceMs);
    this.ghostTimers.get(userId)?.cancel();
    this.ghostTimers.set(
      userId,
      this.timers.runAt(at, () => {
        this.ghostTimers.delete(userId);
        void this.leaveIfStillOffline(userId);
      }),
    );
  }

  userCameBack(userId: string): void {
    this.ghostTimers.get(userId)?.cancel();
    this.ghostTimers.delete(userId);
  }

  private async leaveIfStillOffline(userId: string): Promise<void> {
    try {
      if (!(await this.notifier.isUserConnected(userId))) await this.leave(userId);
    } catch (error) {
      this.logger.error(`Ghost ticket of ${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private scheduleNextMatcherRun(): void {
    if (this.stopped) return;
    const at = new Date(this.clock.now().getTime() + this.settings.matchmaking.tickMs);
    this.matcherTimer = this.timers.runAt(at, () => {
      void this.runMatcherOnce()
        .catch((error: unknown) => {
          this.logger.error(`Matcher: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
        })
        .finally(() => this.scheduleNextMatcherRun());
    });
  }

  /** One matcher tick: pair humans first, then give a bot to everyone who waited long enough. */
  private async runMatcherOnce(): Promise<void> {
    const gameTypes = (Object.keys(this.settings.gameTypes) as RevealGameType[]).filter(
      (gameType) => this.settings.gameTypes[gameType]?.enabled,
    );
    for (const gameType of gameTypes) {
      for (;;) {
        const pair = await this.queue.takeOldestPair(gameType);
        if (pair.length < 2) break;
        await this.startBattle(gameType, pair, false);
      }
      const cutoff = new Date(this.clock.now().getTime() - this.settings.matchmaking.botFallbackAfterMs);
      for (const ticket of await this.queue.takeTicketsQueuedBefore(gameType, cutoff)) {
        await this.startBattle(gameType, [ticket], true);
      }
    }
  }

  private async startBattle(gameType: GameType, tickets: QueueTicket[], withBot: boolean): Promise<void> {
    try {
      await this.engine.createMatchmakingBattle(
        gameType,
        tickets.map((ticket) => ({ userId: ticket.userId, queueActivity: queueActivity(ticket.ticketId) })),
        withBot,
      );
    } catch (error) {
      const code = error instanceof NoPlayableContentError ? 'NO_CONTENT' : 'SERVER_ERROR';
      if (code === 'SERVER_ERROR') this.logger.error(error instanceof Error ? (error.stack ?? error.message) : error);
      for (const ticket of tickets) {
        await this.activities.releaseActivity(ticket.userId, queueActivity(ticket.ticketId));
        this.notifier.sendToUser(ticket.userId, 'error', {
          type: 'error',
          serverTime: this.clock.now().toISOString(),
          data: { code, message: 'No battle could be started' },
        });
      }
    }
  }
}
