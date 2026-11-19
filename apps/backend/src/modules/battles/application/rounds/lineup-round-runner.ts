import type { EngineContent } from '@modules/question-bank';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import {
  type LineupCommand,
  type LineupEvent,
  LineupRules,
  type LineupRoundState,
} from '../../domain/games/lineup-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { LineupGameSettings } from '../battle-settings';
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

// Accepted answer slots of LINEUP content (08 §14.4).
const XI_SLOT = 0;
const FAKE_SLOT = 1;
// Wrong names a bot may pick from, the most popular players outside the XI (08 §14.5).
const BOT_DECOY_POOL_SIZE = 20;

/** An التشكيلة round (08 §14). */
export class LineupRoundRunner implements RoundRunner {
  private readonly rules: LineupRules;
  private state: LineupRoundState | null = null;
  private readonly names: EntityNames = new Map();
  /** Per bot: the starters it knows (entity ids, in the order it will type them) and whether it knows the fake. */
  private readonly botKnowledge = new Map<ParticipantId, { starters: string[]; knowsFake: boolean }>();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    settings: LineupGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new LineupRules({
      roundMs: settings.roundMs,
      lockoutMs: settings.lockoutMs,
      hints: settings.hints,
      accuse: settings.accuse,
      showWrongAnswers: settings.showWrongAnswers,
      latencyGraceMs,
      points: settings.points,
    });
  }

  private get body() {
    if (this.content.body.gameType !== 'LINEUP') throw new Error('A lineup runner needs lineup content');
    return this.content.body;
  }

  async start(): Promise<void> {
    const body = this.body;
    const ids = [...body.slots.map((slot) => slot.playerEntityId), body.fakeEntityId];
    for (const [id, names] of await loadEntityNames(this.host.catalog, ids)) this.names.set(id, names);
    const step = this.rules.startRound({
      roundNo: this.roundNo,
      participants: this.host.activeParticipantIds(),
      slots: body.slots.map((slot) => ({ playerEntityId: slot.playerEntityId, captain: slot.captain })),
      shownEntityIds: body.shownEntityIds,
      fakeEntityId: body.fakeEntityId,
      now: this.host.now(),
    });
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    if (command.type !== 'LINEUP_ANSWER') return 'WRONG_GAME_TYPE';
    const judged = await this.judge(command.answer, this.state);
    if (typeof judged === 'string') return judged;
    const now = this.host.now();
    const result = this.rules.handleCommand(this.state, from, judged, now);
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    // Only the player learns what the name did and, after a wrong one, when they may type again (08 §14.3).
    const placed = result.effects.find(
      (effect) => effect.type === 'EMIT' && effect.event.type === 'PLACED' && effect.event.participantId === from,
    );
    return {
      accepted: true,
      data: {
        result: this.rules.findAnswerResult(result.effects, from),
        ...(placed?.type === 'EMIT' && placed.event.type === 'PLACED' ? { slot: placed.event.slot } : {}),
        lockedUntil: this.rules.lockedUntilOf(result.state, from, now)?.toISOString() ?? null,
      },
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
    return {
      roundNo: this.roundNo,
      title: this.titleFor(viewer),
      ...(state
        ? {
            slots: this.slotsFor(viewer, state),
            shown: this.shownFor(viewer),
            fake: state.fakeUnmaskedBy
              ? { player: entityRef(this.names, state.fakeEntityId, viewer), unmaskedBy: state.fakeUnmaskedBy }
              : null,
            hints: state.hintsGiven > 0 ? this.lettersFor(viewer, this.rules.findEmptySlots(state)) : [],
            lockedUntil: this.rules.lockedUntilOf(state, viewer.id, this.host.now())?.toISOString() ?? null,
            accusationUsed: (state.accusationsUsed[viewer.id] ?? 0) > 0,
            points: state.points,
            roundDeadlineAt: state.deadline.toISOString(),
            hintsAt: state.phase === 'OPEN' ? (this.rules.findNextHintAt(state)?.toISOString() ?? null) : null,
          }
        : {}),
    };
  }

  /**
   * The server's match for a typed name: a starter (unsaid ones win ties), else the fake, else wrong with the
   * other player it named, if any. Bots send the entity id itself.
   */
  private async judge(answer: { text: string } | BotAnswer, state: LineupRoundState): Promise<LineupCommand | string> {
    if ('entityId' in answer) return { type: 'LINEUP_ANSWER', answer: { entityId: answer.entityId } };
    const placed = state.slots.filter((slot) => slot.placed).map((slot) => slot.playerEntityId);
    const contentId = this.content.contentId;
    const inXi = await this.host.checker.judgeTypedText(contentId, XI_SLOT, answer.text, this.host.answerRules, placed);
    if (inXi.verdict === 'EMPTY') return 'EMPTY_ANSWER';
    if (inXi.verdict === 'CORRECT')
      return { type: 'LINEUP_ANSWER', answer: { entityId: inXi.entityId, text: answer.text } };
    const asFake = await this.host.checker.judgeTypedText(contentId, FAKE_SLOT, answer.text, this.host.answerRules);
    const entityId = asFake.verdict === 'CORRECT' ? asFake.entityId : inXi.entityId;
    return { type: 'LINEUP_ANSWER', answer: { entityId, text: answer.text } };
  }

  private async applyEffects(effects: Effect<LineupEvent>[]): Promise<void> {
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
          await this.host.endRound(effect.result, (viewer) => this.buildReveal(viewer));
          return;
      }
    }
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async emitEvent(event: LineupEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        this.prepareBots();
        await this.host.emit('round:start', (viewer) => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          title: this.titleFor(viewer),
          slots: this.body.slots.map((slot, index) => ({
            slot: index,
            line: slot.line,
            role: slot.role,
            captain: slot.captain,
          })),
          shown: this.shownFor(viewer),
          roundDeadlineAt: event.roundDeadlineAt.toISOString(),
          hintsAt: event.hintsAt?.toISOString() ?? null,
        }));
        for (const participantId of this.botKnowledge.keys()) this.scheduleBotAnswer(participantId, this.host.now());
        return;
      case 'PLACED':
        return this.host.emit('lineup:placed', (viewer) => ({
          roundNo: event.roundNo,
          slot: event.slot,
          player: entityRef(this.names, event.entityId, viewer),
          participantId: event.participantId,
        }));
      case 'WRONG':
        return this.host.emit('lineup:wrong', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          ...(event.entityId ? { player: entityRef(this.names, event.entityId, viewer) } : {}),
        }));
      case 'ACCUSED':
        return this.host.emit('lineup:accused', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          right: event.right,
          ...(event.entityId ? { player: entityRef(this.names, event.entityId, viewer) } : {}),
        }));
      case 'HINTS':
        return this.host.emit('lineup:hint', (viewer) => ({
          roundNo: event.roundNo,
          letters: this.lettersFor(viewer, event.slots),
        }));
    }
  }

  private titleFor(viewer: LiveParticipant): string {
    return this.body.title[viewer.locale] ?? Object.values(this.body.title)[0] ?? '';
  }

  private shownFor(viewer: LiveParticipant): { entityId: string; name: string }[] {
    return this.body.shownEntityIds.map((id) => entityRef(this.names, id, viewer));
  }

  private slotsFor(viewer: LiveParticipant, state: LineupRoundState): Record<string, unknown>[] {
    return this.body.slots.map((slot, index) => {
      const placed = state.slots[index];
      return {
        slot: index,
        line: slot.line,
        role: slot.role,
        captain: slot.captain,
        ...(placed?.placed
          ? { placed: { player: entityRef(this.names, slot.playerEntityId, viewer), participantId: placed.placedBy } }
          : { placed: null }),
      };
    });
  }

  /** The first letter of each of these slots' players, in the viewer's language. */
  private lettersFor(viewer: LiveParticipant, slots: number[]): { slot: number; letter: string }[] {
    return slots.map((slot) => {
      const id = this.body.slots[slot]?.playerEntityId ?? '';
      return { slot, letter: [...(this.names.get(id)?.[viewer.locale] ?? '').trim()][0] ?? '' };
    });
  }

  /** The whole XI with shirt numbers and who placed each name, and the fake (08 §14.1 step 7). */
  private buildReveal(viewer: LiveParticipant): Record<string, unknown> {
    const state = this.state;
    if (!state) return {};
    return {
      slots: this.body.slots.map((slot, index) => ({
        slot: index,
        player: entityRef(this.names, slot.playerEntityId, viewer),
        shirtNumber: slot.shirtNumber,
        placedBy: state.slots[index]?.placedBy ?? null,
      })),
      fake: {
        player: entityRef(this.names, state.fakeEntityId, viewer),
        reason: 'BENCH',
        unmaskedBy: state.fakeUnmaskedBy,
      },
    };
  }

  // ---- bot (08 §14.5) ----

  private prepareBots(): void {
    const body = this.body;
    const typeable = body.slots
      .filter((slot) => !body.shownEntityIds.includes(slot.playerEntityId))
      // The captain first: he is worth more.
      .sort((a, b) => Number(b.captain) - Number(a.captain))
      .map((slot) => slot.playerEntityId);
    for (const participant of this.host.participants()) {
      const bot = participant.bot;
      if (!bot) continue;
      const chance = bot.profile.knowsAnswerByDifficulty[Math.min(Math.max(this.content.difficulty, 1), 5) - 1];
      this.botKnowledge.set(participant.id, {
        starters: typeable.filter(() => this.host.random.next() < chance),
        knowsFake: this.host.random.next() < chance,
      });
    }
  }

  /** The bot types one name per typing delay: the fake when it knows it, else a known starter, sometimes a guess. */
  private scheduleBotAnswer(participantId: ParticipantId, notBefore: Date): void {
    const bot = this.host.participants().find((participant) => participant.id === participantId)?.bot;
    const knowledge = this.botKnowledge.get(participantId);
    if (!bot || !knowledge) return;
    const { min, max } = bot.profile.typingDelayMs;
    const at = new Date(notBefore.getTime() + randomIntegerBetween(this.host.random, min, max));
    this.host.schedule(`bot-answer:${participantId}`, at, async () => {
      const state = this.state;
      if (!state || state.phase !== 'OPEN') return;
      const lockedUntil = this.rules.lockedUntilOf(state, participantId, this.host.now());
      if (lockedUntil) return this.scheduleBotAnswer(participantId, lockedUntil);
      const entityId = await this.pickBotName(participantId, state, bot.profile.guessChance);
      if (!entityId) return;
      await this.handleCommand(participantId, { type: 'LINEUP_ANSWER', answer: { entityId } });
      this.scheduleBotAnswer(participantId, this.host.now());
    });
  }

  private async pickBotName(participantId: ParticipantId, state: LineupRoundState, guessChance: number) {
    const knowledge = this.botKnowledge.get(participantId);
    if (!knowledge) return undefined;
    const canAccuse = state.fakeUnmaskedBy === null && (state.accusationsUsed[participantId] ?? 0) === 0;
    if (knowledge.knowsFake && canAccuse) return state.fakeEntityId;
    const open = knowledge.starters.find(
      (id) => !state.slots.some((slot) => slot.playerEntityId === id && slot.placed),
    );
    if (open) return open;
    if (this.host.random.next() >= guessChance || (state.wrongNames[participantId]?.length ?? 0) > 0) return undefined;
    const excluded = [...state.slots.map((slot) => slot.playerEntityId), state.fakeEntityId];
    const decoys = await this.host.catalog.findDecoyEntityIds('PLAYER', excluded, BOT_DECOY_POOL_SIZE);
    return decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
  }
}
