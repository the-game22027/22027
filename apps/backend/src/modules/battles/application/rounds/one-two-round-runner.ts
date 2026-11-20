import type { EngineContent, LinkedAnswers } from '@modules/question-bank';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import {
  ONE_TWO_PASS_TYPES,
  type OneTwoCommand,
  type OneTwoEvent,
  type OneTwoPassType,
  OneTwoRules,
  type OneTwoRoundState,
  type PassAvailability,
  readBurnedNames,
} from '../../domain/games/one-two-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { OneTwoGameSettings } from '../battle-settings';
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

// Right answers the round result shows after a miss, the best known first (08 §15.1 step 8).
const REVEAL_EXAMPLES = 3;
// Wrong names a bot may pick from: the most popular players and clubs (08 §15.5).
const BOT_DECOY_POOL_SIZE = 30;

const isPassType = (value: string): value is OneTwoPassType =>
  (ONE_TWO_PASS_TYPES as readonly string[]).includes(value);

/** A وان تو rally (08 §15): the rules decide, this shell reads the link graph, names entities and plays the bot. */
export class OneTwoRoundRunner implements RoundRunner {
  private readonly rules: OneTwoRules;
  private state: OneTwoRoundState | null = null;
  private readonly names: EntityNames = new Map();
  /** The ball's neighbours for the picked pass type, loaded when the pass is made and kept until the answer. */
  private linked: LinkedAnswers | null = null;
  /** What the current ball offers, without burned names: the bot reads it to pass (08 §15.5). */
  private availability: PassAvailability = {};
  /** Evidence of each return, in the viewer's language, for events, the snapshot and the reveal. */
  private readonly evidence = new Map<string, { en?: string; ar?: string }>();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: OneTwoGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new OneTwoRules({
      pickMs: settings.pickMs,
      answerMs: settings.answerMs,
      offerCount: settings.offerCount,
      minAnswers: settings.minAnswers,
      maxPasses: settings.maxPasses,
      passTypes: settings.passTypes,
      latencyGraceMs,
      showWrongAnswers: settings.showWrongAnswers,
      points: settings.points,
    });
  }

  private get seedEntityId(): string {
    if (this.content.body.gameType !== 'ONE_TWO') throw new Error('A one-two runner needs one-two content');
    return this.content.body.seedEntityId;
  }

  async start(): Promise<void> {
    const seed = this.seedEntityId;
    const players = this.host.activeParticipantIds();
    // The first-mover phase decides (08 §9.1): the rock-paper-scissors winner, later the loser of the last rally.
    const passer = this.host.firstMoverId ?? players[Math.floor(this.host.random.next() * players.length)];
    const burned = readBurnedNames(this.host.carryOver);
    await this.ensureNames([seed, ...burned]);
    this.availability = await this.host.linkGraph.countUnusedLinks(seed, [...burned, seed]);
    await this.host.emit('round:start', (viewer) => ({
      roundNo: this.roundNo,
      gameType: this.host.gameType,
      seed: entityRef(this.names, seed, viewer),
      passerId: passer,
    }));
    const step = this.rules.startRound(
      this.roundNo,
      players,
      seed,
      passer,
      burned,
      this.availability,
      this.host.now(),
      this.host.random,
    );
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    const now = this.host.now();
    if (command.type === 'ONE_TWO_PASS') {
      if (!isPassType(command.passType)) return 'NOT_OFFERED';
      const result = this.rules.handleCommand(
        this.state,
        from,
        { type: 'ONE_TWO_PASS', passType: command.passType },
        now,
        this.host.random,
      );
      if (isRejection(result)) return result.code;
      await this.loadLinkedAnswers(result.state);
      this.state = result.state;
      await this.applyEffects(result.effects);
      return null;
    }
    if (command.type !== 'ONE_TWO_ANSWER') return 'WRONG_GAME_TYPE';
    const early = this.rules.findAnswerRejection(this.state, from, now);
    if (early) return early.code;
    const judged = await this.judge(command.answer, this.state);
    if (typeof judged === 'string') return judged;
    const result = this.rules.handleCommand(this.state, from, judged, this.host.now(), this.host.random);
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    const missed = result.effects.find((effect) => effect.type === 'EMIT' && effect.event.type === 'MISSED');
    return {
      accepted: true,
      data: { result: missed?.type === 'EMIT' && missed.event.type === 'MISSED' ? missed.event.reason : 'RETURNED' },
    };
  }

  async participantLeft(who: ParticipantId): Promise<void> {
    if (!this.state) return;
    const step = this.rules.participantLeft(this.state, who);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  snapshotFor(viewer: LiveParticipant): Record<string, unknown> {
    const state = this.state;
    const seed = this.seedEntityId;
    return {
      roundNo: this.roundNo,
      seed: entityRef(this.names, seed, viewer),
      ...(state
        ? {
            chain: this.chainFor(viewer, state),
            ball: entityRef(this.names, state.ball, viewer),
            passerId: state.passer,
            phase: state.phase,
            offer: state.phase === 'PICKING' ? state.offer : [],
            passType: state.passType,
            deadline: state.phase === 'CLOSED' ? null : state.deadline.toISOString(),
            burned: state.used.map((id) => entityRef(this.names, id, viewer)),
            points: state.points,
          }
        : {}),
    };
  }

  /** The server's match for a typed name among the ball's neighbours; bots send the entity id itself. */
  private async judge(answer: { text: string } | BotAnswer, state: OneTwoRoundState): Promise<OneTwoCommand | string> {
    const linked = this.linked;
    if (!linked) return 'INVALID_STATE';
    let entityId: string | null;
    let isLinked: boolean;
    let typed: { text: string; match?: 'EXACT' | 'TYPO' | 'OTHER_ENTITY' | 'NONE' } | null = null;
    if ('entityId' in answer) {
      entityId = answer.entityId;
      isLinked = linked.answers.some((candidate) => candidate.entityId === entityId);
    } else {
      // Burned names lose ties to unburned ones, so a typo picks the name that can still be said.
      const judgement = await this.host.checker.judgeTypedTextAgainstLinks(
        linked,
        answer.text,
        this.host.answerRules,
        state.used,
      );
      if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
      entityId = judgement.entityId;
      isLinked = judgement.verdict === 'CORRECT';
      typed = { text: answer.text, match: judgement.match };
    }
    const returns = isLinked && entityId !== null && !state.used.includes(entityId);
    const nextAvailability: PassAvailability =
      returns && entityId !== null
        ? await this.host.linkGraph.countUnusedLinks(entityId, [...state.used, entityId])
        : {};
    if (returns && entityId !== null) {
      this.availability = nextAvailability;
      const evidence = linked.answers.find((candidate) => candidate.entityId === entityId)?.evidence;
      if (evidence) this.evidence.set(entityId, evidence);
    }
    if (entityId) await this.ensureNames([entityId]);
    return {
      type: 'ONE_TWO_ANSWER',
      answer: { entityId, ...(typed ?? {}) },
      linked: isLinked,
      nextAvailability,
    };
  }

  /** When a pass is made (by the passer or at the deadline), its answers are read once, before the clock runs. */
  private async loadLinkedAnswers(state: OneTwoRoundState): Promise<void> {
    if (state.phase !== 'ANSWERING' || state.passType === null) return;
    this.linked = await this.host.linkGraph.findLinkedAnswers(state.ball, state.passType);
  }

  private async applyEffects(effects: Effect<OneTwoEvent>[]): Promise<void> {
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
        case 'END_ROUND': {
          const examples = await this.findExamples();
          await this.host.endRound(effect.result, (viewer) => this.buildReveal(viewer, examples));
          return;
        }
      }
    }
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer, this.host.now(), this.host.random);
    await this.loadLinkedAnswers(step.state);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async emitEvent(event: OneTwoEvent): Promise<void> {
    switch (event.type) {
      case 'OFFER':
        await this.host.emit('oneTwo:offer', (viewer) => ({
          roundNo: event.roundNo,
          ball: entityRef(this.names, event.ball, viewer),
          passerId: event.passer,
          passTypes: event.passTypes,
          pickDeadlineAt: event.pickDeadlineAt.toISOString(),
        }));
        this.scheduleBotPass(event.passer);
        return;
      case 'PASSED':
        await this.host.emit('oneTwo:passed', () => ({
          roundNo: event.roundNo,
          passType: event.passType,
          receiverId: event.receiver,
          answerDeadlineAt: event.answerDeadlineAt.toISOString(),
          random: event.random,
        }));
        this.scheduleBotAnswer(event.receiver);
        return;
      case 'RETURNED':
        return this.host.emit('oneTwo:returned', (viewer) => ({
          roundNo: event.roundNo,
          entity: entityRef(this.names, event.entityId, viewer),
          passType: event.passType,
          evidence: this.evidenceFor(event.entityId, viewer),
          participantId: event.participantId,
        }));
      case 'MISSED':
        return this.host.emit('oneTwo:missed', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          reason: event.reason,
          ...(event.entityId ? { entity: entityRef(this.names, event.entityId, viewer) } : {}),
        }));
    }
  }

  private evidenceFor(entityId: string, viewer: LiveParticipant): string {
    const evidence = this.evidence.get(entityId);
    return evidence?.[viewer.locale] ?? evidence?.en ?? '';
  }

  private chainFor(viewer: LiveParticipant, state: OneTwoRoundState): Record<string, unknown>[] {
    return state.chain.map((link) => ({
      entity: entityRef(this.names, link.entityId, viewer),
      passType: link.passType,
      returnedBy: link.returnedBy,
      evidence: this.evidenceFor(link.entityId, viewer),
    }));
  }

  /** After a miss: up to 3 right answers nobody named, the best known first; none after a dead end or max passes. */
  private async findExamples(): Promise<string[]> {
    const state = this.state;
    if (!state || state.endReason !== 'MISSED' || !this.linked) return [];
    const examples = this.linked.answers
      .map((candidate) => candidate.entityId)
      .filter((id) => !state.used.includes(id))
      .slice(0, REVEAL_EXAMPLES);
    await this.ensureNames(examples);
    return examples;
  }

  private buildReveal(viewer: LiveParticipant, examples: string[]): Record<string, unknown> {
    const state = this.state;
    if (!state) return {};
    return {
      seed: entityRef(this.names, this.seedEntityId, viewer),
      chain: this.chainFor(viewer, state),
      endReason: state.endReason,
      missed:
        state.endReason === 'MISSED'
          ? { participantId: state.receiver, reason: state.missReason, passType: state.passType }
          : null,
      examples: examples.map((id) => entityRef(this.names, id, viewer)),
    };
  }

  private async ensureNames(ids: readonly string[]): Promise<void> {
    const missing = ids.filter((id) => !this.names.has(id));
    for (const [id, names] of await loadEntityNames(this.host.catalog, missing)) this.names.set(id, names);
  }

  // ---- bot (08 §15.5) ----

  private botOf(participantId: ParticipantId) {
    return this.host.participants().find((participant) => participant.id === participantId)?.bot;
  }

  private botDelay(participantId: ParticipantId): Date | null {
    const bot = this.botOf(participantId);
    if (!bot) return null;
    const { min, max } = bot.profile.typingDelayMs;
    return new Date(this.host.now().getTime() + randomIntegerBetween(this.host.random, min, max));
  }

  /** The bot passes the type with the fewest unused answers (it may know the counts), now and then one at random. */
  private scheduleBotPass(participantId: ParticipantId): void {
    const at = this.botDelay(participantId);
    const bot = this.botOf(participantId);
    if (!at || !bot) return;
    this.host.schedule(`bot-pass:${participantId}`, at, async () => {
      const state = this.state;
      if (!state || state.phase !== 'PICKING' || state.passer !== participantId || state.offer.length === 0) return;
      const passType =
        this.host.random.next() < bot.profile.guessChance
          ? state.offer[randomIntegerBetween(this.host.random, 0, state.offer.length - 1)]
          : [...state.offer].sort((a, b) => (this.availability[a] ?? 0) - (this.availability[b] ?? 0))[0];
      if (passType) await this.handleCommand(participantId, { type: 'ONE_TWO_PASS', passType });
    });
  }

  /** The bot returns the best-known unused answer when it knows one; otherwise a wrong popular name, or nothing. */
  private scheduleBotAnswer(participantId: ParticipantId): void {
    const at = this.botDelay(participantId);
    const bot = this.botOf(participantId);
    if (!at || !bot) return;
    this.host.schedule(`bot-answer:${participantId}`, at, async () => {
      const state = this.state;
      const linked = this.linked;
      if (!state || !linked || state.phase !== 'ANSWERING' || state.receiver !== participantId) return;
      const difficulty = Math.min(Math.max(this.content.difficulty, 1), 5);
      const chance = bot.profile.knowsAnswerByDifficulty[difficulty - 1];
      const known = linked.answers.find((candidate) => !state.used.includes(candidate.entityId));
      if (known && this.host.random.next() < chance) {
        await this.handleCommand(participantId, { type: 'ONE_TWO_ANSWER', answer: { entityId: known.entityId } });
        return;
      }
      if (this.host.random.next() >= bot.profile.guessChance) return;
      const accepted = linked.answers.map((candidate) => candidate.entityId);
      const kind = linked.passType === 'SCORED_AGAINST' ? 'CLUB' : 'PLAYER';
      const decoys = await this.host.catalog.findDecoyEntityIds(kind, accepted, BOT_DECOY_POOL_SIZE);
      const decoy = decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
      if (decoy) await this.handleCommand(participantId, { type: 'ONE_TWO_ANSWER', answer: { entityId: decoy } });
    });
  }
}
