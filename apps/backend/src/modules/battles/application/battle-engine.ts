import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  AnswerCatalogQuery,
  AnswerChecker,
  ContentSelector,
  type GameType,
  RoundContentQuery,
} from '@modules/question-bank';
import { ScoringRuleSets } from '@modules/points';
import { UsersFacade } from '@modules/users';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator, type Locale } from '@shared/kernel';
import { type BattlePointsRuleSet, selectRuleForBattleMode } from '../domain/leaderboard-points';
import type { RockPaperScissorsChoice } from '../domain/first-mover/rock-paper-scissors-duel';
import { SeededRandom } from '../domain/random-source';
import { parseBattlePointsRuleSet } from './battle-points-rule-set';
import { BATTLE_SETTINGS, type BattleConfigSnapshot, type BattleSettings, findGameSettings } from './battle-settings';
import { type Ack, LiveBattle, type LiveParticipant } from './live-battle';
import { pickContentSkippingSeen } from './pick-content-skipping-seen';
import { ACTIVITY_GUARD, type Activity, type ActivityGuard } from './ports/activity-guard';
import { BATTLE_NOTIFIER, type BattleNotifier } from './ports/battle-notifier';
import { BATTLE_REPOSITORY, type BattleRepository } from './ports/battle-repository';
import { TIMER_SCHEDULER, type TimerScheduler } from './ports/timer-scheduler';
import type { PlayerAnswer, PlayerCommand } from './rounds/round-runner';

export class NoPlayableContentError extends Error {
  constructor(gameType: GameType, locales: Locale[]) {
    super(`No published ${gameType} content in ${locales.join(' and ')}`);
  }
}

const battleActivity = (battleId: string): Activity => `BATTLE:${battleId}`;

/**
 * Owns the battles this API process is running (03 §4): creates them, routes player commands to them,
 * and frees players when they end. Single instance for now; several instances need battle ownership (P6.3+).
 */
@Injectable()
export class BattleEngine implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(BattleEngine.name);
  private readonly live = new Map<string, LiveBattle>();
  /** Which live battle each human is in, for disconnects and reconnects. */
  private readonly battleOfUser = new Map<string, string>();
  private shuttingDown = false;
  /** Parsed BATTLE rule sets by id: a rule set never changes once stored. */
  private readonly pointsRuleSets = new Map<string, BattlePointsRuleSet>();

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
    private readonly scoringRuleSets: ScoringRuleSets,
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

  /** Before, not on, shutdown: the database connection closes in the later hook, after this work is done. */
  async beforeApplicationShutdown(): Promise<void> {
    // From here on, sockets dropping and late commands find no battle, so nothing new reaches the database.
    this.shuttingDown = true;
    const battles = [...this.live.values()];
    this.live.clear();
    this.battleOfUser.clear();
    await Promise.all(battles.map((battle) => battle.stopAndFinishQueuedWork()));
  }

  /**
   * A matchmaking battle (03 §3.3): two queued players, or one queued player and a bot (DEC-39). Moves
   * every player from their queue ticket to the battle. Throws NoPlayableContentError when the bank has
   * nothing playable in all the players' languages.
   */
  async createMatchmakingBattle(
    gameType: GameType,
    players: { userId: string; queueActivity: Activity }[],
    withBot: boolean,
  ): Promise<string> {
    if (this.shuttingDown) throw new Error('The API is shutting down');
    const game = findGameSettings(this.settings, gameType);
    if (!game) throw new Error(`${gameType} has no battle config`);
    const accounts = await Promise.all(
      players.map(async ({ userId }) => {
        const account = await this.users.getAccount(userId);
        if (!account) throw new Error(`User ${userId} not found`);
        return account;
      }),
    );
    const locales = [...new Set(accounts.map((account) => account.locale))];
    const questionIds = await this.pickContent(
      accounts.map((account) => account.id),
      gameType,
      locales,
      game.roundCount,
    );
    const seed = randomInt(2 ** 31);
    const random = new SeededRandom(seed);
    const profileKeys = Object.keys(this.settings.bots.profiles).sort();
    const botProfileKey = withBot ? profileKeys[Math.floor(random.next() * profileKeys.length)] : null;
    const now = this.clock.now();
    const battleId = this.ids.next();
    const readyDeadlineAt = new Date(now.getTime() + this.settings.engine.readyTimeoutMs);
    const config: BattleConfigSnapshot = {
      game,
      engine: this.settings.engine,
      answers: this.settings.answers,
      botProfile: botProfileKey,
      seed,
      leaderboardPoints: await this.findLeaderboardPointsOfMatchmakingBattle(botProfileKey !== null),
    };

    const participants: LiveParticipant[] = accounts.map((account, seat) => ({
      id: this.ids.next(),
      kind: 'HUMAN',
      userId: account.id,
      locale: account.locale,
      seat,
      user: {
        id: account.id,
        displayName: account.displayName,
        username: account.username,
        avatarUrl: account.avatarUrl,
      },
      bot: null,
      ready: false,
      activeSocketId: null,
      connected: true,
      forfeited: false,
    }));
    if (botProfileKey) {
      participants.push({
        id: this.ids.next(),
        kind: 'BOT',
        userId: null,
        locale: accounts[0].locale,
        seat: participants.length,
        user: null,
        bot: { profileKey: botProfileKey, profile: this.settings.bots.profiles[botProfileKey] },
        ready: true,
        activeSocketId: null,
        connected: true,
        forfeited: false,
      });
    }

    await this.battles.createBattle({
      id: battleId,
      mode: 'MATCHMAKING',
      gameType,
      hasBot: botProfileKey !== null,
      config,
      ruleSetId: config.leaderboardPoints?.ruleSetId ?? null,
      createdAt: now,
      readyDeadlineAt,
      questionIds,
      participants: participants.map((participant) => ({
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
    const moved: string[] = [];
    for (const { userId, queueActivity } of players) {
      if (await this.activities.replaceActivity(userId, queueActivity, battleActivity(battleId))) moved.push(userId);
    }
    if (moved.length < players.length) {
      // A player's ticket was no longer theirs (they left at the same moment): nobody plays this battle.
      await this.battles.cancelBattle(battleId, this.clock.now(), 'CANCELLED');
      for (const userId of moved) await this.activities.releaseActivity(userId, battleActivity(battleId));
      throw new Error(`A player left the queue before battle ${battleId} started`);
    }

    const battle = new LiveBattle(battleId, gameType, participants, questionIds, config, readyDeadlineAt, {
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
    for (const { userId } of players) this.battleOfUser.set(userId, battleId);
    await battle.open();
    return battleId;
  }

  /** The active BATTLE rule set's section for this mode (08 §6.1); null when none is active. */
  private async findLeaderboardPointsOfMatchmakingBattle(
    hasBot: boolean,
  ): Promise<BattleConfigSnapshot['leaderboardPoints']> {
    const active = await this.scoringRuleSets.findActiveRuleSet('BATTLE');
    if (!active) {
      this.logger.warn('No active BATTLE rule set: this battle earns no leaderboard points (08 §6.1)');
      return null;
    }
    let ruleSet = this.pointsRuleSets.get(active.id);
    if (!ruleSet) {
      ruleSet = parseBattlePointsRuleSet(active.config);
      this.pointsRuleSets.set(active.id, ruleSet);
    }
    return { ruleSetId: active.id, rule: selectRuleForBattleMode(ruleSet, 'MATCHMAKING', hasBot) };
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
    answer: PlayerAnswer,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.answer(userId, socketId, roundNo, answer, clientMsgId),
    );
  }

  pickRockPaperScissors(
    battleId: string,
    userId: string,
    socketId: string,
    attempt: number,
    choice: RockPaperScissorsChoice,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.pickRockPaperScissors(userId, socketId, attempt, choice, clientMsgId),
    );
  }

  claimGridCell(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    claim: { cell: number; text: string },
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(
        userId,
        socketId,
        roundNo,
        { type: 'GRID_CLAIM', cell: claim.cell, answer: { text: claim.text } },
        clientMsgId,
      ),
    );
  }

  skipGridTurn(battleId: string, userId: string, socketId: string, roundNo: number, clientMsgId: string): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(userId, socketId, roundNo, { type: 'GRID_SKIP' }, clientMsgId),
    );
  }

  /** `mines:bury`, `mines:answer`, `mines:scan` (08 §10.3). */
  sendMinesCommand(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    command: Extract<PlayerCommand, { type: 'MINE_BURY' | 'MINE_ANSWER' | 'MINE_SCAN' }>,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(userId, socketId, roundNo, command, clientMsgId),
    );
  }

  /** `auction:pick`, `auction:bid`, `auction:call`, `auction:answer` (08 §11.3). */
  sendAuctionCommand(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    command: Extract<PlayerCommand, { type: 'AUCTION_PICK' | 'AUCTION_BID' | 'AUCTION_CALL' | 'AUCTION_ANSWER' }>,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(userId, socketId, roundNo, command, clientMsgId),
    );
  }

  /** `hex:pick`, `hex:answer` (08 §13.4). */
  sendHexCommand(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    command: Extract<PlayerCommand, { type: 'HEX_PICK' | 'HEX_ANSWER' }>,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(userId, socketId, roundNo, command, clientMsgId),
    );
  }

  /** `lineup:answer` (08 §14.3). */
  sendLineupAnswer(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    text: string,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(userId, socketId, roundNo, { type: 'LINEUP_ANSWER', answer: { text } }, clientMsgId),
    );
  }

  /** `vault:try` (08 §12.3). */
  sendVaultTry(
    battleId: string,
    userId: string,
    socketId: string,
    roundNo: number,
    code: string,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) =>
      battle.roundCommand(userId, socketId, roundNo, { type: 'VAULT_TRY', code }, clientMsgId),
    );
  }

  forfeit(battleId: string, userId: string, clientMsgId: string): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) => battle.forfeit(userId, clientMsgId));
  }

  resync(battleId: string, userId: string, socketId: string, clientMsgId: string): Promise<Ack> {
    return this.withBattle(battleId, clientMsgId, (battle) => battle.resync(userId, socketId, clientMsgId));
  }

  /** The user's last socket dropped: their battle starts the reconnect grace (WEBSOCKET.md §6). */
  async userDisconnected(userId: string): Promise<void> {
    await this.liveBattleOf(userId)?.disconnect(userId);
  }

  /** A socket of the user connected again; the client then sends battle:resync for the snapshot. */
  async userConnected(userId: string): Promise<void> {
    await this.liveBattleOf(userId)?.reconnect(userId);
  }

  /** The battle a user is playing right now, for play-state. */
  findLiveBattleIdOfUser(userId: string): { battleId: string; status: string } | null {
    const battle = this.liveBattleOf(userId);
    return battle ? { battleId: battle.id, status: battle.status } : null;
  }

  private liveBattleOf(userId: string): LiveBattle | undefined {
    const battleId = this.battleOfUser.get(userId);
    return battleId ? this.live.get(battleId) : undefined;
  }

  private withBattle(battleId: string, clientMsgId: string, run: (battle: LiveBattle) => Promise<Ack>): Promise<Ack> {
    const battle = this.live.get(battleId);
    // A finished or unknown battle looks the same to the caller: they are not playing in it.
    if (!battle) return Promise.resolve({ clientMsgId, accepted: false, code: 'NOT_PARTICIPANT' });
    return run(battle);
  }

  /** DEC-44: what none of the players has seen; seen questions only when the bank is short. */
  private async pickContent(
    userIds: string[],
    gameType: GameType,
    locales: Locale[],
    roundCount: number,
  ): Promise<string[]> {
    const game = findGameSettings(this.settings, gameType);
    const filter = {
      gameType,
      count: roundCount,
      locales,
      ...(game?.selection.difficulties ? { difficulties: game.selection.difficulties } : {}),
      // A grid is picked only when every cell has enough valid players (08 §6).
      ...(game && 'minAnswersPerCell' in game ? { minAnswersPerSlot: game.minAnswersPerCell } : {}),
    };
    const seen = await this.battles.findSeenQuestionIdsMostRecentFirst(userIds);
    const { contentIds, repeatedCount } = await pickContentSkippingSeen(this.selector, filter, seen);
    if (contentIds.length === 0) throw new NoPlayableContentError(gameType, locales);
    if (repeatedCount > 0) {
      this.logger.warn(
        `Seen questions repeated for ${gameType}: ${String(repeatedCount)}/${String(roundCount)} rounds`,
      );
    }
    return contentIds;
  }

  private async forgetBattle(battle: LiveBattle): Promise<void> {
    this.live.delete(battle.id);
    for (const userId of battle.humanUserIds) {
      if (this.battleOfUser.get(userId) === battle.id) this.battleOfUser.delete(userId);
    }
    for (const userId of battle.humanUserIds) await this.activities.releaseActivity(userId, battleActivity(battle.id));
  }
}
