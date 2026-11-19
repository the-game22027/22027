import type { Logger } from '@nestjs/common';
import type { AnswerCatalogQuery, AnswerChecker, GameType, RoundContentQuery } from '@modules/question-bank';
import type { Clock } from '@shared/kernel';
import { chooseNextFirstMover, type FirstMoverOutcome } from '../domain/first-mover/next-first-mover';
import {
  addPick,
  closeAttempt,
  drawRandomChoice,
  findPickRejection,
  hasEveryonePicked,
  type RockPaperScissorsChoice,
  type RockPaperScissorsDuel,
  startRockPaperScissorsDuel,
} from '../domain/first-mover/rock-paper-scissors-duel';
import type { ParticipantId, RoundAction, RoundResult } from '../domain/games/game-rules';
import { calculateLeaderboardPoints } from '../domain/leaderboard-points';
import { placeParticipantsByScore } from '../domain/placements';
import { type RandomSource, randomIntegerBetween } from '../domain/random-source';
import type {
  AuctionGameSettings,
  VaultGameSettings,
  BattleConfigSnapshot,
  GridGameSettings,
  MinesGameSettings,
  RevealGameSettings,
} from './battle-settings';
import type { LiveParticipant } from './live-participant';
import type { BattleNotifier } from './ports/battle-notifier';
import type { BattleRepository } from './ports/battle-repository';
import type { ScheduledTimer, TimerScheduler } from './ports/timer-scheduler';
import { GridRoundRunner } from './rounds/grid-round-runner';
import { AuctionRoundRunner } from './rounds/auction-round-runner';
import { VaultRoundRunner } from './rounds/vault-round-runner';
import { MinesRoundRunner } from './rounds/mines-round-runner';
import { RevealRoundRunner } from './rounds/reveal-round-runner';
import type {
  PlayerAnswer,
  PlayerCommand,
  RoundCommandOutcome,
  RoundHost,
  RoundRunner,
  ViewerData,
} from './rounds/round-runner';

export type { LiveParticipant } from './live-participant';

export interface Ack {
  clientMsgId: string;
  accepted: boolean;
  code?: string;
  /** battle:resync only: what the player missed (WEBSOCKET.md §6). */
  snapshot?: Record<string, unknown>;
  /** A command whose result is private to the sender, such as `mines:bury` (08 §10.3). */
  data?: Record<string, unknown>;
}

type ForfeitReason = 'FORFEIT' | 'GRACE_EXPIRED' | 'NOT_READY';

export interface LiveBattleDependencies {
  repository: BattleRepository;
  notifier: BattleNotifier;
  timers: TimerScheduler;
  clock: Clock;
  rounds: RoundContentQuery;
  checker: AnswerChecker;
  catalog: AnswerCatalogQuery;
  logger: Logger;
  random: RandomSource;
  /** Called once when the battle ends for any reason; the engine forgets it and frees its players. */
  onFinished: (battle: LiveBattle) => Promise<void>;
}

/**
 * One battle while it is played: the imperative shell around the pure rules (08 §2). Every command and
 * timer of this battle runs through one queue, one at a time, in arrival order, which is what makes
 * "first buzz wins" exact (learn/backend/one-at-a-time-per-game.md).
 */
export class LiveBattle {
  status: 'WAITING_READY' | 'PICKING_FIRST' | 'IN_PROGRESS' | 'FINISHED' = 'WAITING_READY';
  private seq = 0;
  /** Set at shutdown: no new timers. */
  private stopped = false;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly timers = new Map<string, ScheduledTimer>();
  private readonly acks = new Map<string, Ack>();
  private readonly scores = new Map<ParticipantId, number>();
  private roundIndex = -1;
  private runner: RoundRunner | null = null;
  private roundActionCount = 0;
  /** clientMsgId of the command being handled, so its recorded action keeps it (duplicate detection). */
  private handlingClientMsgId: string | null = null;
  /** Results of finished rounds, for snapshots. */
  private readonly roundResults: { roundNo: number; winnerParticipantIds: string[] }[] = [];
  /** Who moves first in the current or next round (08 §9.1); null for game types where everyone plays at once. */
  private firstMoverId: ParticipantId | null = null;
  private lastRoundWinnerId: ParticipantId | null = null;
  /** What the last round handed to the next one (08 §10.7); the battle never reads it. */
  private carryOver: unknown = undefined;
  /** The rock-paper-scissors duel while PICKING_FIRST, and the end of its current pick window. */
  private duel: RockPaperScissorsDuel | null = null;
  private duelPickDeadlineAt: Date | null = null;
  private readonly firstMoverOutcomes: FirstMoverOutcome[] = [];

  constructor(
    readonly id: string,
    readonly gameType: GameType,
    readonly participants: LiveParticipant[],
    private readonly questionIds: string[],
    private readonly config: BattleConfigSnapshot,
    readonly readyDeadlineAt: Date,
    private readonly deps: LiveBattleDependencies,
  ) {
    for (const participant of participants) this.scores.set(participant.id, 0);
  }

  get humanUserIds(): string[] {
    return this.participants.flatMap((participant) => (participant.userId ? [participant.userId] : []));
  }

  private get activeParticipants(): LiveParticipant[] {
    return this.participants.filter((participant) => !participant.forfeited);
  }

  /** Announces the battle and starts the ready countdown. */
  open(): Promise<void> {
    return this.runInQueue(async () => {
      this.schedule('ready', this.readyDeadlineAt, () => this.onReadyDeadline());
      await this.emit('battle:found', (viewer) => ({
        gameType: this.gameType,
        mode: 'MATCHMAKING',
        players: this.playersFor(viewer),
        youParticipantId: viewer.id,
        config: this.publicConfig(),
        readyDeadlineAt: this.readyDeadlineAt.toISOString(),
      }));
    });
  }

  ready(userId: string, socketId: string, clientMsgId: string): Promise<Ack> {
    return this.handleCommand(userId, clientMsgId, async (participant) => {
      if (this.status !== 'WAITING_READY' || participant.ready) return 'INVALID_STATE';
      participant.ready = true;
      participant.activeSocketId = socketId;
      await this.deps.repository.markParticipantReady(participant.id, this.deps.clock.now());
      if (this.activeParticipants.every((other) => other.ready)) await this.startBattle();
      return null;
    });
  }

  /** A round command (buzz, answer, grid claim, skip): checked here for what every game shares, then by the round. */
  roundCommand(
    userId: string,
    socketId: string,
    roundNo: number,
    command: PlayerCommand,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.handleCommand(userId, clientMsgId, async (participant) => {
      const problem = this.findRoundCommandProblem(participant, socketId, roundNo);
      if (problem) return problem;
      return this.runner ? this.runner.handleCommand(participant.id, command) : 'INVALID_STATE';
    });
  }

  /** `battle:rps-pick` (WEBSOCKET.md §3): one throw per attempt, kept secret until both are in. */
  pickRockPaperScissors(
    userId: string,
    socketId: string,
    attempt: number,
    choice: RockPaperScissorsChoice,
    clientMsgId: string,
  ): Promise<Ack> {
    return this.handleCommand(userId, clientMsgId, async (participant) => {
      if (this.status !== 'PICKING_FIRST' || !this.duel) return 'INVALID_STATE';
      if (participant.activeSocketId !== socketId) return 'NOT_ACTIVE_SOCKET';
      return this.takeRockPaperScissorsPick(participant.id, attempt, choice);
    });
  }

  buzz(userId: string, socketId: string, roundNo: number, clientMsgId: string): Promise<Ack> {
    return this.roundCommand(userId, socketId, roundNo, { type: 'BUZZ' }, clientMsgId);
  }

  answer(userId: string, socketId: string, roundNo: number, answer: PlayerAnswer, clientMsgId: string): Promise<Ack> {
    return this.roundCommand(userId, socketId, roundNo, { type: 'ANSWER', answer }, clientMsgId);
  }

  /** Leaving for good (WEBSOCKET.md §3 `battle:forfeit`): last placement, and the others play on or win. */
  forfeit(userId: string, clientMsgId: string): Promise<Ack> {
    return this.handleCommand(userId, clientMsgId, async (participant) => {
      if (this.status === 'FINISHED' || participant.forfeited) return 'INVALID_STATE';
      await this.forfeitParticipant(participant, 'FORFEIT');
      return null;
    });
  }

  /**
   * The full state a returning player needs (WEBSOCKET.md §6), with only what was already revealed. The
   * resyncing socket becomes the active one, so a reconnecting device takes over.
   */
  resync(userId: string, socketId: string, clientMsgId: string): Promise<Ack> {
    return this.runInQueue(async () => {
      const viewer = this.participants.find((candidate) => candidate.userId === userId);
      if (!viewer) return { clientMsgId, accepted: false, code: 'NOT_PARTICIPANT' };
      if (viewer.ready && !viewer.forfeited) viewer.activeSocketId = socketId;
      return Promise.resolve({ clientMsgId, accepted: true, snapshot: this.snapshotFor(viewer) });
    });
  }

  /** The user's last socket dropped: the battle goes on, and they have `reconnectGraceMs` to come back. */
  disconnect(userId: string): Promise<void> {
    return this.runInQueue(async () => {
      const participant = this.participants.find((candidate) => candidate.userId === userId);
      if (!participant || !participant.connected || participant.forfeited || this.status === 'FINISHED') return;
      participant.connected = false;
      const now = this.deps.clock.now();
      const graceUntil = new Date(now.getTime() + this.config.engine.reconnectGraceMs);
      await this.deps.repository.markParticipantDisconnected(participant.id, now);
      this.schedule(`grace:${participant.id}`, graceUntil, () => this.forfeitParticipant(participant, 'GRACE_EXPIRED'));
      await this.emit('player:disconnected', () => ({
        participantId: participant.id,
        graceUntil: graceUntil.toISOString(),
      }));
    });
  }

  reconnect(userId: string): Promise<void> {
    return this.runInQueue(async () => {
      const participant = this.participants.find((candidate) => candidate.userId === userId);
      if (!participant || participant.connected || participant.forfeited || this.status === 'FINISHED') return;
      participant.connected = true;
      this.cancel(`grace:${participant.id}`);
      await this.deps.repository.markParticipantDisconnected(participant.id, null);
      await this.emit('player:reconnected', () => ({ participantId: participant.id }));
    });
  }

  /** Stops every timer; used when the process shuts down. */
  stopTimers(): void {
    for (const timer of this.timers.values()) timer.cancel();
    this.timers.clear();
  }

  /**
   * Stops the timers, then waits for the work already queued (a timer that fired, a command being handled), so
   * nothing writes to the database after it has closed.
   */
  async stopAndFinishQueuedWork(): Promise<void> {
    this.stopped = true;
    this.stopTimers();
    let queued: Promise<unknown>;
    do {
      queued = this.queue;
      await queued;
    } while (queued !== this.queue);
  }

  // ---- command plumbing ----

  private runInQueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch((error: unknown) => {
      this.deps.logger.error(
        `Battle ${this.id}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
    });
    return run;
  }

  private handleCommand(
    userId: string,
    clientMsgId: string,
    handle: (participant: LiveParticipant) => Promise<RoundCommandOutcome>,
  ): Promise<Ack> {
    return this.runInQueue(async () => {
      const participant = this.participants.find((candidate) => candidate.userId === userId);
      if (!participant) return { clientMsgId, accepted: false, code: 'NOT_PARTICIPANT' };
      const key = `${participant.id}:${clientMsgId}`;
      const earlier = this.acks.get(key);
      if (earlier) return earlier;
      this.handlingClientMsgId = clientMsgId;
      try {
        const outcome = await handle(participant);
        const ack: Ack =
          typeof outcome === 'string'
            ? { clientMsgId, accepted: false, code: outcome }
            : { clientMsgId, accepted: true, ...(outcome ? { data: outcome.data } : {}) };
        this.acks.set(key, ack);
        return ack;
      } finally {
        this.handlingClientMsgId = null;
      }
    });
  }

  private findRoundCommandProblem(participant: LiveParticipant, socketId: string, roundNo: number): string | null {
    if (this.status !== 'IN_PROGRESS' || !this.runner) return 'INVALID_STATE';
    if (participant.activeSocketId !== socketId) return 'NOT_ACTIVE_SOCKET';
    if (roundNo < this.runner.roundNo) return 'ROUND_CLOSED';
    if (roundNo > this.runner.roundNo) return 'ROUND_NOT_CURRENT';
    return null;
  }

  private schedule(key: string, at: Date, task: () => Promise<void>): void {
    // Work still finishing during shutdown must not start new timers.
    if (this.stopped) return;
    this.cancel(key);
    this.timers.set(
      key,
      this.deps.timers.runAt(at, () => {
        this.timers.delete(key);
        void this.runInQueue(async () => {
          if (this.status !== 'FINISHED') await task();
        });
      }),
    );
  }

  private cancel(key: string): void {
    this.timers.get(key)?.cancel();
    this.timers.delete(key);
  }

  // ---- battle lifecycle ----

  /** 03 §4.2: start with whoever is ready if that is at least two, otherwise cancel. A bot alone does not count. */
  private async onReadyDeadline(): Promise<void> {
    if (this.status !== 'WAITING_READY') return;
    const ready = this.activeParticipants.filter((participant) => participant.ready);
    if (ready.length < 2 || !ready.some((participant) => participant.kind === 'HUMAN')) {
      await this.cancelBattle('READY_TIMEOUT');
      return;
    }
    for (const participant of this.activeParticipants.filter((candidate) => !candidate.ready)) {
      await this.forfeitParticipant(participant, 'NOT_READY');
    }
    if (this.status === 'WAITING_READY') await this.startBattle();
  }

  private async cancelBattle(reason: 'READY_TIMEOUT' | 'PLAYER_LEFT'): Promise<void> {
    await this.deps.repository.cancelBattle(this.id, this.deps.clock.now(), 'CANCELLED');
    await this.emit('battle:cancelled', () => ({ reason }));
    await this.finish();
  }

  /**
   * One participant is out for good. Mid-round, the rules release their buzz; then the battle ends when
   * no human is left (ABANDONED) or only one participant is (FORFEIT), as in 03 §4.3 step 8.
   */
  private async forfeitParticipant(participant: LiveParticipant, reason: ForfeitReason): Promise<void> {
    if (participant.forfeited || this.status === 'FINISHED') return;
    participant.forfeited = true;
    this.cancel(`grace:${participant.id}`);
    await this.deps.repository.markParticipantForfeited(participant.id, this.deps.clock.now());
    await this.emit('player:forfeited', () => ({ participantId: participant.id, reason }));

    if (this.status === 'WAITING_READY') {
      if (reason !== 'NOT_READY') await this.cancelBattle('PLAYER_LEFT');
      return;
    }
    await this.runner?.participantLeft(participant.id);
    if (!this.isBeingPlayed()) return;
    const active = this.activeParticipants;
    if (!active.some((candidate) => candidate.kind === 'HUMAN')) await this.abandon();
    else if (active.length < 2) await this.completeBattle('FORFEIT');
  }

  private async abandon(): Promise<void> {
    await this.deps.repository.abandonBattle(this.id, this.deps.clock.now());
    await this.emit('battle:completed', () => ({ endReason: 'ABANDONED', placements: [], pointsPending: false }));
    await this.finish();
  }

  private async startBattle(): Promise<void> {
    this.cancel('ready');
    this.status = 'IN_PROGRESS';
    const now = this.deps.clock.now();
    await this.deps.repository.markBattleStarted(this.id, now);
    await this.emit('battle:started', (viewer) => ({ startedAt: now.toISOString(), players: this.playersFor(viewer) }));
    await this.decideFirstMoverThenStartRound();
  }

  /** Not read through a narrowed `this.status`: awaited work may have finished the battle. */
  private isBeingPlayed(): boolean {
    return this.status === 'IN_PROGRESS' || this.status === 'PICKING_FIRST';
  }

  // ---- first mover (08 §9.1, ADR-0023) ----

  /** Decides who moves first in the next round, then starts it. A rock-paper-scissors duel starts it once decided. */
  private async decideFirstMoverThenStartRound(): Promise<void> {
    const { firstMover, firstMoverAfterRound1 = 'ALTERNATE', rps } = this.config.game;
    const roundNo = this.roundIndex + 2;
    const active = this.activeParticipants.map((participant) => participant.id);
    if (firstMover === 'NONE') {
      this.firstMoverId = null;
      await this.startNextRound();
      return;
    }
    if (this.firstMoverId && firstMoverAfterRound1 !== 'RPS_EACH_ROUND') {
      const seatOrder = [...this.participants].sort((a, b) => a.seat - b.seat).map((participant) => participant.id);
      this.firstMoverId = chooseNextFirstMover(
        firstMoverAfterRound1,
        seatOrder,
        active,
        this.firstMoverId,
        this.lastRoundWinnerId,
      );
      await this.recordFirstMover({
        beforeRound: roundNo,
        winnerId: this.firstMoverId,
        decidedBy: firstMoverAfterRound1,
      });
      await this.startNextRound();
      return;
    }
    if (firstMover === 'RPS' && rps && active.length === 2) {
      this.status = 'PICKING_FIRST';
      this.duel = startRockPaperScissorsDuel([active[0], active[1]], rps.maxReplays);
      await this.openDuelAttempt();
      return;
    }
    // TODO(DEC-70): rooms with 3 or more players get a seeded random first mover instead of a duel.
    this.firstMoverId = active[Math.floor(this.deps.random.next() * active.length)];
    await this.recordFirstMover({ beforeRound: roundNo, winnerId: this.firstMoverId, decidedBy: 'RANDOM' });
    await this.startNextRound();
  }

  private async openDuelAttempt(): Promise<void> {
    const duel = this.duel;
    const rps = this.config.game.rps;
    if (!duel || !rps) return;
    const now = this.deps.clock.now();
    const deadline = new Date(now.getTime() + rps.pickMs);
    this.duelPickDeadlineAt = deadline;
    await this.emit('battle:rps-start', () => ({ attempt: duel.attempt, pickDeadlineAt: deadline.toISOString() }));
    this.schedule('rps-close', new Date(deadline.getTime() + this.config.engine.latencyGraceMs), () =>
      this.closeDuelAttempt(),
    );
    for (const bot of this.activeParticipants.filter((participant) => participant.kind === 'BOT')) {
      const delayMs = randomIntegerBetween(this.deps.random, rps.botPickDelayMs.min, rps.botPickDelayMs.max);
      this.schedule(`rps-bot:${bot.id}`, new Date(now.getTime() + delayMs), async () => {
        await this.takeRockPaperScissorsPick(bot.id, duel.attempt, drawRandomChoice(this.deps.random));
      });
    }
  }

  /** null when the pick is taken, otherwise the ack's error code. The attempt closes as soon as both have picked. */
  private async takeRockPaperScissorsPick(
    from: ParticipantId,
    attempt: number,
    choice: RockPaperScissorsChoice,
  ): Promise<string | null> {
    if (this.status !== 'PICKING_FIRST' || !this.duel) return 'INVALID_STATE';
    const rejection = findPickRejection(this.duel, from, attempt);
    if (rejection) return rejection;
    const deadline = this.duelPickDeadlineAt;
    if (!deadline || this.deps.clock.now().getTime() > deadline.getTime() + this.config.engine.latencyGraceMs) {
      return 'PICK_WINDOW_CLOSED';
    }
    this.duel = addPick(this.duel, from, choice);
    if (hasEveryonePicked(this.duel)) await this.closeDuelAttempt();
    return null;
  }

  /** Reveals both throws together; then the next attempt, or round 1 with the winner moving first. */
  private async closeDuelAttempt(): Promise<void> {
    const rps = this.config.game.rps;
    if (this.status !== 'PICKING_FIRST' || !this.duel || !rps) return;
    for (const key of [...this.timers.keys()]) if (key.startsWith('rps-')) this.cancel(key);
    const { duel, closed, decision } = closeAttempt(this.duel, this.deps.random);
    this.duelPickDeadlineAt = null;
    await this.emit('battle:rps-result', () => ({
      attempt: closed.attempt,
      picks: closed.picks,
      winnerId: decision?.winnerId ?? null,
      decidedBy: decision?.decidedBy ?? null,
    }));
    const nextAt = new Date(this.deps.clock.now().getTime() + rps.revealMs);
    if (!decision) {
      this.duel = duel;
      this.schedule('rps-next', nextAt, () => this.openDuelAttempt());
      return;
    }
    this.duel = null;
    this.firstMoverId = decision.winnerId;
    await this.recordFirstMover({
      beforeRound: this.roundIndex + 2,
      winnerId: decision.winnerId,
      decidedBy: decision.decidedBy,
      attempts: duel.closedAttempts.map(({ attempt, picks }) => ({ attempt, picks })),
    });
    this.schedule('rps-next', nextAt, async () => {
      this.status = 'IN_PROGRESS';
      await this.startNextRound();
    });
  }

  private async recordFirstMover(outcome: FirstMoverOutcome): Promise<void> {
    this.firstMoverOutcomes.push(outcome);
    await this.deps.repository.saveFirstMoverOutcomes(this.id, this.firstMoverOutcomes);
  }

  private async startNextRound(): Promise<void> {
    this.roundIndex += 1;
    const roundNo = this.roundIndex + 1;
    const locales = [...new Set(this.participants.map((participant) => participant.locale))];
    const content = await this.deps.rounds.getContentForEngine(this.questionIds[this.roundIndex], locales);
    const host = this.roundHost();
    const latencyGraceMs = this.config.engine.latencyGraceMs;
    // The registry of 08 §2.2: the one place that picks a mechanic from the game type.
    switch (content.body.gameType) {
      case 'GRID':
        this.runner = new GridRoundRunner(roundNo, content, this.config.game as GridGameSettings, latencyGraceMs, host);
        break;
      case 'MINES':
        this.runner = new MinesRoundRunner(
          roundNo,
          content,
          this.config.game as MinesGameSettings,
          latencyGraceMs,
          host,
        );
        break;
      case 'AUCTION':
        this.runner = new AuctionRoundRunner(
          roundNo,
          content,
          this.config.game as AuctionGameSettings,
          latencyGraceMs,
          host,
        );
        break;
      case 'VAULT':
        this.runner = new VaultRoundRunner(
          roundNo,
          content,
          this.config.game as VaultGameSettings,
          latencyGraceMs,
          host,
        );
        break;
      default:
        this.runner = new RevealRoundRunner(
          roundNo,
          content,
          this.config.game as RevealGameSettings,
          latencyGraceMs,
          host,
        );
    }
    this.roundActionCount = 0;
    await this.deps.repository.markRoundStarted(this.id, roundNo, this.deps.clock.now());
    await this.runner.start();
  }

  private roundHost(): RoundHost {
    return {
      gameType: this.gameType,
      firstMoverId: this.firstMoverId,
      carryOver: this.carryOver,
      random: this.deps.random,
      checker: this.deps.checker,
      catalog: this.deps.catalog,
      answerRules: this.config.answers,
      now: () => this.deps.clock.now(),
      participants: () => this.participants,
      activeParticipantIds: () => this.activeParticipants.map((participant) => participant.id),
      emit: (type, dataFor) => this.emit(type, dataFor),
      schedule: (key, at, task) => this.schedule(`round:${key}`, at, task),
      cancel: (key) => this.cancel(`round:${key}`),
      recordAction: (action) => this.recordRoundAction(action),
      endRound: (result, revealFor) => this.endRound(result, revealFor),
    };
  }

  private async recordRoundAction(action: RoundAction): Promise<void> {
    if (!this.runner) return;
    this.roundActionCount += 1;
    const isTimeout = action.kind === 'ANSWER_TIMEOUT' || action.kind === 'TURN_TIMEOUT';
    await this.deps.repository.recordRoundAction(
      this.id,
      this.runner.roundNo,
      this.roundActionCount,
      action,
      isTimeout ? null : this.handlingClientMsgId,
    );
  }

  private async endRound(result: RoundResult, revealFor: ViewerData): Promise<void> {
    const runner = this.runner;
    if (!runner) return;
    for (const key of [...this.timers.keys()]) if (key.startsWith('round:')) this.cancel(key);
    const now = this.deps.clock.now();
    await this.deps.repository.closeRound(this.id, runner.roundNo, result, now);
    for (const [participantId, points] of Object.entries(result.points)) {
      this.scores.set(participantId, (this.scores.get(participantId) ?? 0) + points);
    }
    this.lastRoundWinnerId = result.winnerParticipantId;
    this.carryOver = result.carryOver;
    this.roundResults.push({
      roundNo: runner.roundNo,
      winnerParticipantIds: result.winnerParticipantId ? [result.winnerParticipantId] : [],
    });
    await this.emit('round:result', (viewer) => ({
      roundNo: runner.roundNo,
      // Sent only once the round is over, for POST /v1/questions/{id}/reports (08 §5.7).
      questionId: this.questionIds[runner.roundNo - 1],
      winnerParticipantIds: result.winnerParticipantId ? [result.winnerParticipantId] : [],
      reveal: revealFor(viewer),
      points: this.participants.map((participant) => ({
        participantId: participant.id,
        points: result.points[participant.id] ?? 0,
      })),
      scores: this.participants.map((participant) => ({
        participantId: participant.id,
        score: this.scores.get(participant.id) ?? 0,
      })),
    }));
    if (this.status !== 'IN_PROGRESS') return;
    if (this.roundIndex + 1 < this.questionIds.length && !this.hasAnyoneReachedTargetScore()) {
      this.schedule('next-round', new Date(now.getTime() + this.config.engine.betweenRoundsMs), () =>
        this.decideFirstMoverThenStartRound(),
      );
    } else {
      await this.completeBattle();
    }
  }

  /** A game type with `targetScore` ends as soon as one score reaches it (08 §11.7). */
  private hasAnyoneReachedTargetScore(): boolean {
    const target = this.config.game.targetScore;
    if (target === undefined || target === null) return false;
    return [...this.scores.values()].some((score) => score >= target);
  }

  /** Those still in the battle are placed by score; those who left come after them, all as losses (DEC-33). */
  private async completeBattle(endReason: 'COMPLETED' | 'FORFEIT' = 'COMPLETED'): Promise<void> {
    const active = this.activeParticipants;
    const stillIn = placeParticipantsByScore(
      new Map(active.map((participant) => [participant.id, this.scores.get(participant.id) ?? 0])),
    );
    const left = this.participants
      .filter((participant) => participant.forfeited)
      .map((participant) => ({
        participantId: participant.id,
        score: this.scores.get(participant.id) ?? 0,
        placement: active.length + 1,
        outcome: 'LOSS' as const,
      }));
    const placements = [...stillIn, ...left];
    const rule = this.config.leaderboardPoints?.rule ?? null;
    const leaderboardPoints = Object.fromEntries(
      placements.map(({ participantId, outcome }) => [
        participantId,
        this.participants.find((participant) => participant.id === participantId)?.kind === 'HUMAN'
          ? calculateLeaderboardPoints(rule, outcome, endReason)
          : 0,
      ]),
    );
    await this.deps.repository.completeBattle({
      battleId: this.id,
      endedAt: this.deps.clock.now(),
      endReason,
      placements,
      leaderboardPoints,
    });
    await this.emit('battle:completed', (viewer) => {
      const mine = placements.find((placement) => placement.participantId === viewer.id);
      const points = leaderboardPoints[viewer.id] ?? 0;
      return {
        endReason,
        you: { placement: mine?.placement, outcome: mine?.outcome, score: mine?.score, points },
        placements: placements.map(({ participantId, placement, score }) => ({ participantId, placement, score })),
        // The ledger and leaderboards update asynchronously (08 §6.1).
        pointsPending: points > 0,
      };
    });
    await this.finish();
  }

  private async finish(): Promise<void> {
    this.status = 'FINISHED';
    this.stopTimers();
    await this.deps.onFinished(this);
  }

  // ---- events ----

  /** One event to every human, each in their own locale; all share one `seq` (WEBSOCKET.md §2). */
  private async emit(type: string, dataFor: (viewer: LiveParticipant) => Record<string, unknown>): Promise<void> {
    this.seq += 1;
    const serverTime = this.deps.clock.now().toISOString();
    for (const viewer of this.participants) {
      if (!viewer.userId) continue;
      this.deps.notifier.sendToUser(viewer.userId, type, {
        battleId: this.id,
        seq: this.seq,
        serverTime,
        type,
        data: dataFor(viewer),
      });
    }
    return Promise.resolve();
  }

  private snapshotFor(viewer: LiveParticipant): Record<string, unknown> {
    return {
      status: this.status,
      gameType: this.gameType,
      mode: 'MATCHMAKING',
      players: this.playersFor(viewer),
      ...this.firstMoverSnapshotFor(viewer),
      ...(this.runner ? { currentRound: this.runner.snapshotFor(viewer) } : {}),
      rounds: this.roundResults,
      scores: this.participants.map((participant) => ({
        participantId: participant.id,
        score: this.scores.get(participant.id) ?? 0,
      })),
      seq: this.seq,
    };
  }

  /** The duel as far as it was revealed: the viewer learns only whether they picked themselves (08 §9.1). */
  private firstMoverSnapshotFor(viewer: LiveParticipant): Record<string, unknown> {
    const duel = this.duel;
    if (this.status === 'PICKING_FIRST' && duel) {
      return {
        firstMover: {
          attempt: duel.attempt,
          pickDeadlineAt: this.duelPickDeadlineAt?.toISOString() ?? null,
          youPicked: duel.picks.some((pick) => pick.participantId === viewer.id),
          attempts: duel.closedAttempts,
        },
      };
    }
    return this.firstMoverId ? { firstMover: { participantId: this.firstMoverId } } : {};
  }

  private playersFor(viewer: LiveParticipant): Record<string, unknown>[] {
    return this.participants.map((participant) => ({
      participantId: participant.id,
      kind: participant.kind,
      seat: participant.seat,
      ...(participant.forfeited ? { forfeited: true } : {}),
      ...(participant.user ? { user: participant.user } : {}),
      ...(participant.bot ? { bot: { displayName: participant.bot.profile.displayNames[viewer.locale] } } : {}),
    }));
  }

  /** What a client may know about the rules: timers and attempts, never content (WEBSOCKET.md §4.3). */
  private publicConfig(): Record<string, unknown> {
    const hidden = new Set(['enabled', 'points', 'selection']);
    const rules = Object.fromEntries(Object.entries(this.config.game).filter(([key]) => !hidden.has(key)));
    // Bot timing stays on the server: it would tell a player when the bot is about to pick.
    if (this.config.game.rps) {
      const { pickMs, maxReplays, revealMs } = this.config.game.rps;
      rules['rps'] = { pickMs, maxReplays, revealMs };
    }
    return {
      ...rules,
      roundCount: this.questionIds.length,
      betweenRoundsMs: this.config.engine.betweenRoundsMs,
      answerMaxLength: this.config.answers.maxLength,
    };
  }
}
