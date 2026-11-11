import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  AnswerCatalogQuery,
  AnswerChecker,
  ContentSelector,
  type GameType,
  RoundContentQuery,
} from '@modules/question-bank';
import { UsersFacade } from '@modules/users';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator, type Locale } from '@shared/kernel';
import type { TypedAnswer } from '../domain/games/game-rules';
import { SeededRandom } from '../domain/random-source';
import { BATTLE_SETTINGS, type BattleConfigSnapshot, type BattleSettings } from './battle-settings';
import { type Ack, LiveBattle, type LiveParticipant } from './live-battle';
import { ACTIVITY_GUARD, type Activity, type ActivityGuard } from './ports/activity-guard';
import { BATTLE_NOTIFIER, type BattleNotifier } from './ports/battle-notifier';
import { BATTLE_REPOSITORY, type BattleRepository } from './ports/battle-repository';
import { TIMER_SCHEDULER, type TimerScheduler } from './ports/timer-scheduler';

export class NoPlayableContentError extends Error {
  constructor(gameType: GameType, locale: Locale) {
    super(`No published ${gameType} content in ${locale}`);
  }
}

const battleActivity = (battleId: string): Activity => `BATTLE:${battleId}`;

/**
 * Owns the battles this API process is running (03 §4): creates them, routes player commands to them,
 * and frees players when they end. Single instance for now; several instances need battle ownership (P6.3+).
 */
@Injectable()
export class BattleEngine implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BattleEngine.name);
  private readonly live = new Map<string, LiveBattle>();

  constructor(
    @Inject(BATTLE_REPOSITORY) private readonly battles: BattleRepository,
    @Inject(ACTIVITY_GUARD) private readonly activities: ActivityGuard,
    @Inject(BATTLE_NOTIFIER) private readonly notifier: BattleNotifier,
    @Inject(TIMER_SCHEDULER) private readonly timers: TimerScheduler,
    @Inject(BATTLE_SETTINGS) private readonly settings: BattleSettings,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly selector: ContentSelector,
    private readonly rounds: RoundContentQuery,
    private readonly checker: AnswerChecker,
    private readonly catalog: AnswerCatalogQuery,
    private readonly users: UsersFacade,
  ) {}

  /**
   * In the background: the API must start (and report "not ready") even while Postgres or Redis is down,
   * so the boot never waits for this cleanup.
   */
  onApplicationBootstrap(): void {
    this.abandonBattlesLeftByPreviousProcess().catch((error: unknown) => {
      this.logger.error(
        `Could not abandon unfinished battles: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  /** Nothing runs the battles a previous process left unfinished (WEBSOCKET.md §6.5): close them, free their players. */
  private async abandonBattlesLeftByPreviousProcess(): Promise<void> {
    const { battleIds, userIds } = await this.battles.abandonUnfinishedBattles(this.clock.now());
    for (const userId of userIds) {
      const activity = await this.activities.findActivity(userId);
      if (activity && battleIds.some((battleId) => activity === battleActivity(battleId))) {
        await this.activities.releaseActivity(userId, activity);
      }
    }
    if (battleIds.length > 0)
      this.logger.warn(`Abandoned ${String(battleIds.length)} battles left by a previous process`);
  }

  onApplicationShutdown(): void {
    for (const battle of this.live.values()) battle.stopTimers();
  }

  /**
   * The bot fallback of matchmaking (DEC-39): one human against one bot. Moves the player from their queue
   * ticket to the battle. Throws NoPlayableContentError when the bank has nothing to play.
   */
  async createBotBattle(userId: string, gameType: GameType, queueActivity: Activity): Promise<string> {
    const game = this.settings.gameTypes[gameType as 'BUZZER'];
    if (!game) throw new Error(`${gameType} has no battle config`);
    const account = await this.users.getAccount(userId);
    if (!account) throw new Error(`User ${userId} not found`);

    const questionIds = await this.pickContent(userId, gameType, account.locale, game.roundCount);
    const seed = randomInt(2 ** 31);
    const random = new SeededRandom(seed);
    const profileKeys = Object.keys(this.settings.bots.profiles).sort();
    const botProfileKey = profileKeys[Math.floor(random.next() * profileKeys.length)];
    const botProfile = this.settings.bots.profiles[botProfileKey];
    const now = this.clock.now();
    const battleId = this.ids.next();
    const readyDeadlineAt = new Date(now.getTime() + this.settings.engine.readyTimeoutMs);
    const config: BattleConfigSnapshot = { game, engine: this.settings.engine, botProfile: botProfileKey, seed };

    const human: LiveParticipant = {
      id: this.ids.next(),
      kind: 'HUMAN',
      userId,
      locale: account.locale,
      seat: 0,
      user: { id: userId, displayName: account.displayName, username: account.username, avatarUrl: account.avatarUrl },
      bot: null,
      ready: false,
      activeSocketId: null,
    };
    const bot: LiveParticipant = {
      id: this.ids.next(),
      kind: 'BOT',
      userId: null,
      locale: account.locale,
      seat: 1,
      user: null,
      bot: { profileKey: botProfileKey, profile: botProfile },
      ready: true,
      activeSocketId: null,
    };

    await this.battles.createBattle({
      id: battleId,
      mode: 'MATCHMAKING',
      gameType,
      hasBot: true,
      config,
      createdAt: now,
      readyDeadlineAt,
      questionIds,
      participants: [human, bot].map((participant) => ({
        id: participant.id,
        kind: participant.kind,
        userId: participant.userId,
        botProfile: participant.bot?.profileKey ?? null,
        botDisplay: participant.bot?.profile.displayNames ?? null,
        locale: participant.locale,
        seat: participant.seat,
        readyAt: participant.kind === 'BOT' ? now : null,
      })),
    });
    if (!(await this.activities.replaceActivity(userId, queueActivity, battleActivity(battleId)))) {
      // The player left the queue while the battle was being made: nobody will play it.
      await this.battles.cancelBattle(battleId, this.clock.now(), 'CANCELLED');
      throw new Error(`User ${userId} left the queue before battle ${battleId} started`);
    }

    const battle = new LiveBattle(battleId, gameType, [human, bot], questionIds, config, readyDeadlineAt, {
      repository: this.battles,
      notifier: this.notifier,
      timers: this.timers,
      clock: this.clock,
      rounds: this.rounds,
      checker: this.checker,
      catalog: this.catalog,
      logger: this.logger,
      random,
      onFinished: (finished) => this.forgetBattle(finished),
    });
    this.live.set(battleId, battle);
    await battle.open();
    return battleId;
  }

  ready(battleId: string, userId: string, socketId: string, clientMsgId: string): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) => battle.ready(userId, socketId, clientMsgId));
  }

  buzz(battleId: string, userId: string, socketId: string, roundNo: number, clientMsgId: string): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) => battle.buzz(userId, socketId, roundNo, clientMsgId));
  }

  answer(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    answer: TypedAnswer,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.answer(userId, socketId, roundNo, answer, clientMsgId),
    );
  }

  private withBattle(battleId: string, clientMsgId: string, run: (battle: LiveBattle) => Promise<Ack>): Promise<Ack> {
    const battle = this.live.get(battleId);
    // A finished or unknown battle looks the same to the caller: they are not playing in it.
    if (!battle) return Promise.resolve({ clientMsgId, accepted: false, code: 'NOT_PARTICIPANT' });
    return run(battle);
  }

  /**
   * DEC-44: skip what the player saw in their last battles. When the bank is too small for that, play what
   * there is rather than nothing (the window relaxes).
   */
  private async pickContent(userId: string, gameType: GameType, locale: Locale, roundCount: number): Promise<string[]> {
    const game = this.settings.gameTypes[gameType as 'BUZZER'];
    const recent = await this.battles.findRecentlyPlayedQuestionIds(userId, game?.selection.excludeLastBattles ?? 0);
    const criteria = {
      gameType,
      count: roundCount,
      locales: [locale],
      ...(game?.selection.difficulties ? { difficulties: game.selection.difficulties } : {}),
    };
    const fresh = await this.selector.pickContentIds({ ...criteria, excludeContentIds: recent });
    if (fresh.length === roundCount || recent.length === 0) {
      if (fresh.length === 0) throw new NoPlayableContentError(gameType, locale);
      return fresh;
    }
    this.logger.warn(
      `Exposure window relaxed for ${gameType}: ${String(fresh.length)}/${String(roundCount)} fresh rounds`,
    );
    const any = await this.selector.pickContentIds({ ...criteria, excludeContentIds: [] });
    if (any.length === 0) throw new NoPlayableContentError(gameType, locale);
    return any;
  }

  private async forgetBattle(battle: LiveBattle): Promise<void> {
    this.live.delete(battle.id);
    for (const userId of battle.humanUserIds) await this.activities.releaseActivity(userId, battleActivity(battle.id));
  }
}
