import type { EngineContent } from '@modules/question-bank';
import {
  type AuctionCommand,
  type AuctionEvent,
  AuctionRules,
  type AuctionRoundState,
  type AuctionTextAnswer,
} from '../../domain/games/auction-rules';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { AuctionGameSettings } from '../battle-settings';
import type { LiveParticipant } from '../live-participant';
import {
  type BotAnswer,
  type EntityNames,
  entityRef,
  loadEntityNames,
  type PlayerCommand,
  type RoundCommandOutcome,
  type RoundHost,
  type RoundRunner,
} from './round-runner';

// How many wrong players a bot picks from when it answers wrong.
const BOT_DECOY_POOL_SIZE = 30;

/** A المزاد round (08 §11). */
export class AuctionRoundRunner implements RoundRunner {
  private readonly rules: AuctionRules;
  private state: AuctionRoundState | null = null;
  private readonly names: EntityNames = new Map();
  private readonly namesByList: string[][];

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: AuctionGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new AuctionRules({
      pickMs: settings.pickMs,
      bidTurnMs: settings.bidding.turnMs,
      minOpeningBid: settings.bidding.minOpeningBid,
      proofMs: settings.proof.ms,
      proofMaxWrong: settings.proof.maxWrong,
      allInMaxWrong: settings.allIn.maxWrong,
      stealMs: settings.steal.ms,
      stealNames: settings.steal.names,
      latencyGraceMs,
      showWrongAnswers: settings.showWrongAnswers,
      points: settings.points,
    });
    this.namesByList = this.body.lists.map(
      (_, slot) => content.acceptedAnswers.find((answer) => answer.slot === slot)?.entityIds ?? [],
    );
  }

  private get body() {
    if (this.content.body.gameType !== 'AUCTION') throw new Error('An auction runner needs auction content');
    return this.content.body;
  }

  async start(): Promise<void> {
    const players = this.host.activeParticipantIds();
    // The first-mover phase decides (08 §9.1): the rock-paper-scissors winner, later the loser of the last round.
    const picker = this.host.firstMoverId ?? players[Math.floor(this.host.random.next() * players.length)];
    const step = this.rules.startRound(
      this.roundNo,
      players,
      this.namesByList.map((names) => names.length),
      picker,
      this.host.now(),
    );
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    switch (command.type) {
      case 'AUCTION_PICK':
        return this.applyCommand(from, { type: 'AUCTION_PICK', list: command.list });
      case 'AUCTION_BID':
        return this.applyCommand(from, { type: 'AUCTION_BID', amount: command.amount });
      case 'AUCTION_CALL':
        return this.applyCommand(from, { type: 'AUCTION_CALL' });
      case 'AUCTION_ANSWER': {
        const problem = this.rules.findAnswerRejection(this.state, from, this.host.now());
        if (problem) return problem.code;
        const judged = await this.judgeAgainstPickedList(command.answer, this.state);
        if (typeof judged === 'string') return judged;
        return this.applyCommand(from, { type: 'AUCTION_ANSWER', ...judged });
      }
      default:
        return 'WRONG_GAME_TYPE';
    }
  }

  async participantLeft(who: ParticipantId): Promise<void> {
    if (!this.state) return;
    const step = this.rules.participantLeft(this.state, who);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  snapshotFor(viewer: LiveParticipant): Record<string, unknown> {
    const state = this.state;
    return {
      roundNo: this.roundNo,
      lists: this.listsFor(viewer),
      ...(state
        ? {
            phase: state.phase,
            picker: state.picker,
            pickedList: state.pickedList,
            bids: state.bids,
            turnOf: state.phase === 'BIDDING' ? state.turnOf : null,
            prover: state.prover,
            amount: state.amount,
            allIn: state.allIn,
            maxWrong: this.rules.maxWrongOf(state),
            found: this.saidNamesFor(state, viewer),
            strikes: state.strikes,
            stealer: state.stealer,
            deadlines: { [this.deadlineNameOf(state)]: state.deadline.toISOString() },
          }
        : {}),
    };
  }

  /** The verdict against the picked list, or the ack's error code. Said names lose ties to unsaid ones (08 §5.3). */
  private async judgeAgainstPickedList(
    answer: { text: string } | BotAnswer,
    state: AuctionRoundState,
  ): Promise<{ answer: AuctionTextAnswer; inList: boolean } | string> {
    const slot = state.pickedList ?? 0;
    if ('entityId' in answer) {
      return { answer, inList: (this.namesByList[slot] ?? []).includes(answer.entityId) };
    }
    const judgement = await this.host.checker.judgeTypedText(
      this.content.contentId,
      slot,
      answer.text,
      this.host.answerRules,
      state.used,
    );
    if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
    return {
      answer: { entityId: judgement.entityId, text: answer.text, match: judgement.match },
      inList: judgement.verdict === 'CORRECT',
    };
  }

  private async applyCommand(from: ParticipantId, command: AuctionCommand): Promise<string | null> {
    if (!this.state) return 'INVALID_STATE';
    const result = this.rules.handleCommand(this.state, from, command, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    return null;
  }

  private async applyEffects(effects: Effect<AuctionEvent>[]): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case 'EMIT':
          await this.emitEvent(effect.event);
          break;
        case 'SCHEDULE':
          this.host.schedule(`rules:${effect.timer}`, effect.at, () => this.onRulesTimer(effect.timer));
          break;
        case 'CANCEL':
          this.host.cancel(`rules:${effect.timer}`);
          break;
        case 'RECORD_ACTION':
          await this.host.recordAction(effect.action);
          break;
        case 'END_ROUND':
          await this.host.endRound(effect.result, await this.buildReveal());
          return;
      }
    }
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer, this.host.now(), this.host.random);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async emitEvent(event: AuctionEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        this.scheduleBotPick(event.picker);
        return this.host.emit('round:start', (viewer) => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          lists: this.listsFor(viewer),
          pickerParticipantId: event.picker,
          pickDeadlineAt: event.pickDeadlineAt.toISOString(),
        }));
      case 'PICKED':
        return this.host.emit('auction:picked', (viewer) => ({
          roundNo: event.roundNo,
          list: event.list,
          title: this.body.lists[event.list]?.title[viewer.locale] ?? '',
          answerCount: this.namesByList[event.list]?.length ?? 0,
          auto: event.auto,
        }));
      case 'TURN':
        this.scheduleBotBid(event.participantId);
        return this.host.emit('auction:turn', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          currentBid: event.currentBid,
          currentBidderId: event.currentBidderId,
          turnDeadlineAt: event.turnDeadlineAt.toISOString(),
        }));
      case 'BID':
        return this.host.emit('auction:bid', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          amount: event.amount,
          allIn: event.allIn,
        }));
      case 'PROOF':
        this.scheduleBotAnswers(event.prover, event.amount + event.maxWrong);
        return this.host.emit('auction:proof', () => ({
          roundNo: event.roundNo,
          proverParticipantId: event.prover,
          amount: event.amount,
          maxWrong: event.maxWrong,
          proofDeadlineAt: event.proofDeadlineAt.toISOString(),
          reason: event.reason,
        }));
      case 'ANSWERED': {
        const entityId = event.entityId;
        if (entityId && !this.names.has(entityId)) {
          for (const [id, names] of await loadEntityNames(this.host.catalog, [entityId])) this.names.set(id, names);
        }
        return this.host.emit('auction:answered', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          phase: event.phase,
          outcome: event.outcome,
          ...(entityId ? { player: entityRef(this.names, entityId, viewer) } : {}),
          found: event.found,
          strikes: event.strikes,
        }));
      }
      case 'STEAL':
        this.scheduleBotAnswers(event.stealer, event.names);
        return this.host.emit('auction:steal', () => ({
          roundNo: event.roundNo,
          stealerParticipantId: event.stealer,
          names: event.names,
          stealDeadlineAt: event.stealDeadlineAt.toISOString(),
        }));
    }
  }

  private listsFor(viewer: LiveParticipant) {
    return this.body.lists.map((list, slot) => ({
      title: list.title[viewer.locale] ?? '',
      answerCount: this.namesByList[slot]?.length ?? 0,
    }));
  }

  private saidNamesFor(state: AuctionRoundState, viewer: LiveParticipant) {
    return state.used.map((id) => ({ player: entityRef(this.names, id, viewer), saidBy: state.saidBy[id] }));
  }

  private deadlineNameOf(state: AuctionRoundState): string {
    switch (state.phase) {
      case 'PICKING':
        return 'pickDeadlineAt';
      case 'BIDDING':
        return 'turnDeadlineAt';
      case 'PROVING':
        return 'proofDeadlineAt';
      default:
        return 'stealDeadlineAt';
    }
  }

  /** Every name of the picked list, marked with who said it (08 §11.1 step 8). */
  private async buildReveal(): Promise<(viewer: LiveParticipant) => Record<string, unknown>> {
    const state = this.state;
    if (!state) return () => ({});
    const listNames = state.pickedList === null ? [] : (this.namesByList[state.pickedList] ?? []);
    for (const [id, names] of await loadEntityNames(this.host.catalog, listNames)) this.names.set(id, names);
    return (viewer) => ({
      list: state.pickedList,
      outcome: state.outcome,
      bid: state.amount,
      answers: listNames.map((id) => ({
        player: entityRef(this.names, id, viewer),
        ...(state.saidBy[id] ? { saidBy: state.saidBy[id] } : {}),
      })),
    });
  }

  // ---- bot (08 §11.5) ----

  private botOf(participantId: ParticipantId) {
    return this.host.participants().find((participant) => participant.id === participantId)?.bot ?? null;
  }

  private knowChanceOf(bot: NonNullable<LiveParticipant['bot']>): number {
    return bot.profile.knowsAnswerByDifficulty[Math.min(Math.max(this.content.difficulty, 1), 5) - 1];
  }

  private delayFor(bot: NonNullable<LiveParticipant['bot']>): Date {
    const { min, max } = bot.profile.typingDelayMs;
    return new Date(this.host.now().getTime() + randomIntegerBetween(this.host.random, min, max));
  }

  private scheduleBotPick(picker: ParticipantId): void {
    const bot = this.botOf(picker);
    if (!bot) return;
    this.host.schedule(`bot-pick:${picker}`, this.delayFor(bot), async () => {
      if (this.state?.phase !== 'PICKING') return;
      const biggest = this.namesByList.reduce(
        (best, names, slot) => (names.length > (this.namesByList[best]?.length ?? 0) ? slot : best),
        0,
      );
      await this.handleCommand(picker, { type: 'AUCTION_PICK', list: biggest });
    });
  }

  private scheduleBotBid(participantId: ParticipantId): void {
    const bot = this.botOf(participantId);
    if (!bot) return;
    this.host.schedule(`bot-bid:${participantId}`, this.delayFor(bot), async () => {
      const state = this.state;
      if (state?.phase !== 'BIDDING' || state.turnOf !== participantId || state.pickedList === null) return;
      const size = this.namesByList[state.pickedList]?.length ?? 0;
      const expected = Math.max(
        1,
        Math.round(size * this.knowChanceOf(bot)) + randomIntegerBetween(this.host.random, -1, 1),
      );
      const current = state.bids.at(-1)?.amount ?? null;
      if (current === null) {
        const opening = Math.max(this.settings.bidding.minOpeningBid, Math.min(size, Math.ceil(expected / 2)));
        await this.handleCommand(participantId, { type: 'AUCTION_BID', amount: opening });
      } else if (current < expected && current < size) {
        await this.handleCommand(participantId, { type: 'AUCTION_BID', amount: current + 1 });
      } else {
        await this.handleCommand(participantId, { type: 'AUCTION_CALL' });
      }
    });
  }

  /** The bot sends up to `tries` names, one after another, while it is still its turn to answer. */
  private scheduleBotAnswers(participantId: ParticipantId, tries: number): void {
    const bot = this.botOf(participantId);
    if (!bot || tries <= 0) return;
    this.host.schedule(`bot-answer:${participantId}`, this.delayFor(bot), async () => {
      const state = this.state;
      const answering = state?.phase === 'PROVING' ? state.prover : state?.phase === 'STEALING' ? state.stealer : null;
      if (!state || answering !== participantId || state.pickedList === null) return;
      const list = this.namesByList[state.pickedList] ?? [];
      const unsaid = list.find((id) => !state.used.includes(id));
      const entityId =
        unsaid && this.host.random.next() < this.knowChanceOf(bot) ? unsaid : await this.pickWrongPlayer(list);
      if (!entityId) return;
      await this.handleCommand(participantId, { type: 'AUCTION_ANSWER', answer: { entityId } });
      this.scheduleBotAnswers(participantId, tries - 1);
    });
  }

  private async pickWrongPlayer(excluded: string[]): Promise<string | undefined> {
    const decoys = await this.host.catalog.findDecoyEntityIds('PLAYER', excluded, BOT_DECOY_POOL_SIZE);
    return decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
  }
}
