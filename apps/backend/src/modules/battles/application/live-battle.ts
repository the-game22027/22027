import type { Logger } from '@nestjs/common';
import type {
  AnswerCatalogQuery,
  AnswerChecker,
  EngineContent,
  GameType,
  RoundContentQuery,
} from '@modules/question-bank';
import type { Clock, Locale } from '@shared/kernel';
import { type BotProfile, type BotRoundPlan, planBotRound } from '../domain/bots/reveal-and-buzz-bot';
import { isRejection, type ParticipantId, type RoundResult, type TypedAnswer } from '../domain/games/game-rules';
import {
  type AnswerVerdict,
  type RevealCommand,
  type RevealEvent,
  type RevealRoundState,
  RevealAndBuzzRules,
} from '../domain/games/reveal-and-buzz-rules';
import { placeParticipantsByScore } from '../domain/placements';
import { type RandomSource, randomIntegerBetween } from '../domain/random-source';
import type { BattleConfigSnapshot } from './battle-settings';
import { listEntityIdsShownInSteps, revealStepsForLocale } from './reveal-steps';
import type { BattleNotifier } from './ports/battle-notifier';
import type { BattleRepository } from './ports/battle-repository';
import type { ScheduledTimer, TimerScheduler } from './ports/timer-scheduler';

export interface Ack {
  clientMsgId: string;
  accepted: boolean;
  code?: string;
  /** battle:resync only: what the player missed (WEBSOCKET.md §6). */
  snapshot?: Record<string, unknown>;
}

export interface LiveParticipant {
  id: ParticipantId;
  kind: 'HUMAN' | 'BOT';
  userId: string | null;
  locale: Locale;
  seat: number;
  /** Public profile for humans, display names for bots (DEC-40: bots are always labeled). */
  user: { id: string; displayName: string; username: string | null; avatarUrl: string | null } | null;
  bot: { profileKey: string; profile: BotProfile } | null;
  ready: boolean;
  /** The socket that sent battle:ready or, later, battle:resync; only it may buzz and answer (WEBSOCKET.md §1). */
  activeSocketId: string | null;
  connected: boolean;
  /** Left for good: forfeit, grace expired, or not ready in time. */
  forfeited: boolean;
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

interface CurrentRound {
  roundNo: number;
  content: EngineContent;
  state: RevealRoundState;
  actionCount: number;
  stepsByLocale: Partial<Record<Locale, string[]>>;
  names: Map<string, { en: string; ar: string }>;
  bots: Map<ParticipantId, { plan: BotRoundPlan; status: 'WAITING' | 'SCHEDULED' | 'DONE' }>;
}

// How many wrong answers a bot picks from when it answers wrong.
const BOT_DECOY_POOL_SIZE = 30;

/**
 * One battle while it is played: the imperative shell around the pure rules (08 §2). Every command and
 * timer of this battle runs through one queue, one at a time, in arrival order, which is what makes
 * "first buzz wins" exact (learn/backend/one-at-a-time-per-game.md).
 */
export class LiveBattle {
  status: 'WAITING_READY' | 'IN_PROGRESS' | 'FINISHED' = 'WAITING_READY';
  private seq = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly timers = new Map<string, ScheduledTimer>();
  private readonly acks = new Map<string, Ack>();
  private readonly scores = new Map<ParticipantId, number>();
  private readonly rules: RevealAndBuzzRules;
  private roundIndex = -1;
  private round: CurrentRound | null = null;
  /** clientMsgId of the command being handled, so its recorded action keeps it (duplicate detection). */
  private handlingClientMsgId: string | null = null;
  /** Results of finished rounds, for snapshots. */
  private readonly roundResults: { roundNo: number; winnerParticipantIds: string[] }[] = [];

  constructor(
    readonly id: string,
    readonly gameType: GameType,
    readonly participants: LiveParticipant[],
    private readonly questionIds: string[],
    private readonly config: BattleConfigSnapshot,
    readonly readyDeadlineAt: Date,
    private readonly deps: LiveBattleDependencies,
  ) {
    this.rules = new RevealAndBuzzRules({ ...config.game, latencyGraceMs: config.engine.latencyGraceMs });
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

  buzz(userId: string, socketId: string, roundNo: number, clientMsgId: string): Promise<Ack> {
    return this.handleCommand(userId, clientMsgId, async (participant) => {
      const problem = this.findRoundCommandProblem(participant, socketId, roundNo);
      if (problem) return problem;
      return this.applyRevealCommand(participant.id, { type: 'BUZZ' });
    });
  }

  answer(userId: string, socketId: string, roundNo: number, answer: TypedAnswer, clientMsgId: string): Promise<Ack> {
    return this.handleCommand(userId, clientMsgId, async (participant) => {
      const problem = this.findRoundCommandProblem(participant, socketId, roundNo);
      if (problem) return problem;
      return this.judgeAndApplyAnswer(participant.id, answer);
    });
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
    handle: (participant: LiveParticipant) => Promise<string | null>,
  ): Promise<Ack> {
    return this.runInQueue(async () => {
      const participant = this.participants.find((candidate) => candidate.userId === userId);
      if (!participant) return { clientMsgId, accepted: false, code: 'NOT_PARTICIPANT' };
      const key = `${participant.id}:${clientMsgId}`;
      const earlier = this.acks.get(key);
      if (earlier) return earlier;
      this.handlingClientMsgId = clientMsgId;
      try {
        const code = await handle(participant);
        const ack: Ack = code ? { clientMsgId, accepted: false, code } : { clientMsgId, accepted: true };
        this.acks.set(key, ack);
        return ack;
      } finally {
        this.handlingClientMsgId = null;
      }
    });
  }

  private findRoundCommandProblem(participant: LiveParticipant, socketId: string, roundNo: number): string | null {
    if (this.status !== 'IN_PROGRESS' || !this.round) return 'INVALID_STATE';
    if (participant.activeSocketId !== socketId) return 'NOT_ACTIVE_SOCKET';
    if (roundNo < this.round.roundNo) return 'ROUND_CLOSED';
    if (roundNo > this.round.roundNo) return 'ROUND_NOT_CURRENT';
    return null;
  }

  private schedule(key: string, at: Date, task: () => Promise<void>): void {
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
    const round = this.round;
    if (round && round.state.phase !== 'CLOSED') {
      const step = this.rules.participantLeft(round.state, participant.id, this.deps.clock.now());
      round.state = step.state;
      await this.applyEffects(step.effects);
    }
    if (this.status !== 'IN_PROGRESS') return;
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
    await this.startNextRound();
  }

  private async startNextRound(): Promise<void> {
    this.roundIndex += 1;
    const roundNo = this.roundIndex + 1;
    const locales = [...new Set(this.participants.map((participant) => participant.locale))];
    const content = await this.deps.rounds.getContentForEngine(this.questionIds[this.roundIndex], locales);
    const acceptedIds = content.acceptedAnswers.flatMap((slot) => slot.entityIds);
    const names = new Map(
      (await this.deps.catalog.findEntitiesByIds([...acceptedIds, ...listEntityIdsShownInSteps(content.body)])).map(
        (entity) => [entity.id, entity.names],
      ),
    );
    const showYears = { showYears: this.config.game.showYears ?? true };
    const stepsByLocale = Object.fromEntries(
      locales.map((locale) => [locale, revealStepsForLocale(content.body, names, locale, showYears)]),
    ) as Partial<Record<Locale, string[]>>;
    const stepCount = stepsByLocale[locales[0]]?.length ?? 0;
    const now = this.deps.clock.now();
    const step = this.rules.startRound(
      roundNo,
      stepCount,
      this.activeParticipants.map((participant) => participant.id),
      now,
    );
    this.round = {
      roundNo,
      content,
      state: step.state,
      actionCount: 0,
      stepsByLocale,
      names,
      bots: this.planBots(content, stepCount),
    };
    await this.deps.repository.markRoundStarted(this.id, roundNo, now);
    await this.applyEffects(step.effects);
  }

  private async endRound(result: RoundResult): Promise<void> {
    const round = this.round;
    if (!round) return;
    for (const key of [...this.timers.keys()]) if (key.startsWith('bot-')) this.cancel(key);
    const now = this.deps.clock.now();
    await this.deps.repository.closeRound(this.id, round.roundNo, result, now);
    for (const [participantId, points] of Object.entries(result.points)) {
      this.scores.set(participantId, (this.scores.get(participantId) ?? 0) + points);
    }
    this.roundResults.push({
      roundNo: round.roundNo,
      winnerParticipantIds: result.winnerParticipantId ? [result.winnerParticipantId] : [],
    });
    const answerId = round.content.acceptedAnswers[0]?.entityIds[0];
    const body = round.content.body;
    await this.emit('round:result', (viewer) => ({
      roundNo: round.roundNo,
      winnerParticipantIds: result.winnerParticipantId ? [result.winnerParticipantId] : [],
      reveal: {
        steps: round.stepsByLocale[viewer.locale] ?? [],
        answer:
          body.gameType === 'BUZZER' && body.answerNumber !== null
            ? { number: body.answerNumber }
            : answerId
              ? { entityId: answerId, name: round.names.get(answerId)?.[viewer.locale] ?? '' }
              : null,
        ...(body.gameType === 'BUZZER' && body.explanation?.[viewer.locale]
          ? { explanation: body.explanation[viewer.locale] }
          : {}),
      },
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
    if (this.roundIndex + 1 < this.questionIds.length) {
      this.schedule('next-round', new Date(now.getTime() + this.config.engine.betweenRoundsMs), () =>
        this.startNextRound(),
      );
    } else {
      await this.completeBattle();
    }
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
    await this.deps.repository.completeBattle({
      battleId: this.id,
      endedAt: this.deps.clock.now(),
      endReason,
      placements,
    });
    await this.emit('battle:completed', (viewer) => {
      const mine = placements.find((placement) => placement.participantId === viewer.id);
      return {
        endReason,
        you: { placement: mine?.placement, outcome: mine?.outcome, score: mine?.score },
        placements: placements.map(({ participantId, placement, score }) => ({ participantId, placement, score })),
        // Bot battles earn no ledger points (DEC-41).
        pointsPending: false,
      };
    });
    await this.finish();
  }

  private async finish(): Promise<void> {
    this.status = 'FINISHED';
    this.stopTimers();
    await this.deps.onFinished(this);
  }

  // ---- rules ----

  private async applyRevealCommand(from: ParticipantId, command: RevealCommand): Promise<string | null> {
    const round = this.round;
    if (!round) return 'INVALID_STATE';
    const result = this.rules.handleCommand(round.state, from, command, this.deps.clock.now());
    if (isRejection(result)) return result.code;
    round.state = result.state;
    await this.applyEffects(result.effects);
    return null;
  }

  private async judgeAndApplyAnswer(from: ParticipantId, answer: TypedAnswer): Promise<string | null> {
    const round = this.round;
    if (!round) return 'INVALID_STATE';
    const rejection = this.rules.findAnswerRejection(round.state, from, this.deps.clock.now());
    if (rejection) return rejection.code;
    const verdict = await this.judgeAnswer(round, answer);
    if (verdict === 'UNKNOWN_ENTITY') return 'UNKNOWN_ENTITY';
    return this.applyRevealCommand(from, { type: 'ANSWER', answer, verdict });
  }

  private async judgeAnswer(round: CurrentRound, answer: TypedAnswer): Promise<AnswerVerdict | 'UNKNOWN_ENTITY'> {
    if ('number' in answer) {
      if (round.content.answerKind !== 'NUMBER') return 'UNKNOWN_ENTITY';
      const body = round.content.body;
      return body.gameType === 'BUZZER' && body.answerNumber === answer.number ? 'CORRECT' : 'WRONG';
    }
    if (round.content.answerKind === 'NUMBER') return 'UNKNOWN_ENTITY';
    return this.deps.checker.checkTypedAnswer(round.content.contentId, 0, answer.entityId);
  }

  private async onRulesTimer(timer: string): Promise<void> {
    const round = this.round;
    if (!round) return;
    const step = this.rules.handleTimer(round.state, timer, this.deps.clock.now());
    round.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async applyEffects(effects: ReturnType<RevealAndBuzzRules['startRound']>['effects']): Promise<void> {
    for (const effect of effects) {
      const round = this.round;
      if (!round) return;
      switch (effect.type) {
        case 'EMIT':
          await this.emitRevealEvent(round, effect.event);
          break;
        case 'SCHEDULE':
          this.schedule(`rules:${effect.timer}`, effect.at, () => this.onRulesTimer(effect.timer));
          break;
        case 'CANCEL':
          this.cancel(`rules:${effect.timer}`);
          break;
        case 'RECORD_ACTION':
          round.actionCount += 1;
          await this.deps.repository.recordRoundAction(
            this.id,
            round.roundNo,
            round.actionCount,
            effect.action,
            effect.action.kind === 'ANSWER_TIMEOUT' ? null : this.handlingClientMsgId,
          );
          break;
        case 'END_ROUND':
          await this.endRound(effect.result);
          return;
      }
    }
    this.scheduleBotBuzzes();
  }

  private async emitRevealEvent(round: CurrentRound, event: RevealEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        return this.emit('round:start', () => ({
          roundNo: event.roundNo,
          gameType: this.gameType,
          answerKind: round.content.answerKind,
          stepCount: event.stepCount,
        }));
      case 'CLUE_REVEALED':
        return this.emit('round:clue', (viewer) => ({
          roundNo: event.roundNo,
          index: event.index,
          clue: round.stepsByLocale[viewer.locale]?.[event.index - 1] ?? '',
          nextClueAt: event.nextClueAt?.toISOString() ?? null,
        }));
      case 'BUZZED':
        this.scheduleBotAnswer(round, event.participantId);
        return this.emit('round:buzzed', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          answerDeadlineAt: event.answerDeadlineAt.toISOString(),
        }));
      case 'WRONG_ANSWER': {
        const answer = event.answer;
        const names =
          answer && 'entityId' in answer
            ? new Map((await this.deps.catalog.findEntitiesByIds([answer.entityId])).map((e) => [e.id, e.names]))
            : new Map<string, { en: string; ar: string }>();
        return this.emit('round:wrong', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          ...(answer
            ? {
                answer:
                  'entityId' in answer
                    ? { entityId: answer.entityId, name: names.get(answer.entityId)?.[viewer.locale] ?? '' }
                    : answer,
              }
            : {}),
          timedOut: event.timedOut,
        }));
      }
      case 'RESUMED':
        return this.emit('round:resumed', () => ({
          roundNo: event.roundNo,
          nextClueAt: event.nextClueAt?.toISOString() ?? null,
        }));
    }
  }

  // ---- bots (08 §3.3) ----

  private planBots(content: EngineContent, stepCount: number): CurrentRound['bots'] {
    const plans: CurrentRound['bots'] = new Map();
    for (const participant of this.participants) {
      if (!participant.bot) continue;
      const plan = planBotRound(participant.bot.profile, content.difficulty, stepCount, this.deps.random);
      plans.set(participant.id, { plan, status: plan.buzzAfterStep === null ? 'DONE' : 'WAITING' });
    }
    return plans;
  }

  /** A bot buzzes a little after its planned step is out, if the buzzer is free and it is not locked out. */
  private scheduleBotBuzzes(): void {
    const round = this.round;
    if (!round || round.state.phase === 'CLOSED' || round.state.phase === 'ANSWERING') return;
    for (const [botId, bot] of round.bots) {
      if (bot.status !== 'WAITING' || round.state.stepsRevealed < (bot.plan.buzzAfterStep ?? Infinity)) continue;
      const profile = this.participants.find((participant) => participant.id === botId)?.bot?.profile;
      if (!profile) continue;
      bot.status = 'SCHEDULED';
      const delay = randomIntegerBetween(this.deps.random, profile.reactionDelayMs.min, profile.reactionDelayMs.max);
      this.schedule(`bot-buzz:${botId}`, new Date(this.deps.clock.now().getTime() + delay), async () => {
        const code = await this.applyRevealCommand(botId, { type: 'BUZZ' });
        // Someone else holds the buzzer: try again when the reveal resumes.
        bot.status = code === 'BUZZ_TAKEN' ? 'WAITING' : 'DONE';
      });
    }
  }

  private scheduleBotAnswer(round: CurrentRound, buzzerId: ParticipantId): void {
    const bot = round.bots.get(buzzerId);
    if (!bot) return;
    const at = new Date(this.deps.clock.now().getTime() + bot.plan.typingDelayMs);
    this.schedule(`bot-answer:${buzzerId}`, at, async () => {
      const answer = await this.chooseBotAnswer(round, bot.plan.answersCorrectly);
      if (answer) await this.judgeAndApplyAnswer(buzzerId, answer);
    });
  }

  private async chooseBotAnswer(round: CurrentRound, correct: boolean): Promise<TypedAnswer | null> {
    const { content } = round;
    const accepted = content.acceptedAnswers.flatMap((slot) => slot.entityIds);
    if (content.answerKind === 'NUMBER') {
      const body = content.body;
      const number = body.gameType === 'BUZZER' ? body.answerNumber : null;
      if (number === null) return null;
      return { number: correct ? number : number + randomIntegerBetween(this.deps.random, 1, 3) };
    }
    if (correct) return accepted[0] ? { entityId: accepted[0] } : null;
    const decoys = await this.deps.catalog.findDecoyEntityIds(content.answerKind, accepted, BOT_DECOY_POOL_SIZE);
    if (decoys.length === 0) return null;
    return { entityId: decoys[randomIntegerBetween(this.deps.random, 0, decoys.length - 1)] };
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
    const round = this.round;
    const state = round?.state;
    return {
      status: this.status === 'FINISHED' ? 'FINISHED' : this.status,
      gameType: this.gameType,
      mode: 'MATCHMAKING',
      players: this.playersFor(viewer),
      ...(round && state
        ? {
            currentRound: {
              roundNo: round.roundNo,
              phase: state.phase,
              stepCount: state.stepCount,
              revealedClues: (round.stepsByLocale[viewer.locale] ?? []).slice(0, state.stepsRevealed),
              buzzHolder: state.buzzHolder,
              lockedOut: state.participants.filter((id) => this.rules.isLockedOut(state, id)),
              deadlines: {
                answerDeadlineAt: state.answerDeadlineAt?.toISOString() ?? null,
                nextClueAt: state.phase === 'REVEALING' ? (state.nextDeadlineAt?.toISOString() ?? null) : null,
              },
            },
          }
        : {}),
      rounds: this.roundResults,
      scores: this.participants.map((participant) => ({
        participantId: participant.id,
        score: this.scores.get(participant.id) ?? 0,
      })),
      seq: this.seq,
    };
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
    const { game, engine } = this.config;
    return {
      roundCount: this.questionIds.length,
      revealIntervalMs: game.revealIntervalMs,
      answerWindowMs: game.answerWindowMs,
      finalWindowMs: game.finalWindowMs,
      attemptsPerPlayer: game.attemptsPerPlayer,
      showWrongAnswers: game.showWrongAnswers,
      betweenRoundsMs: engine.betweenRoundsMs,
    };
  }
}
