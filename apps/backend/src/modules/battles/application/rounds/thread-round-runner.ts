import type { EngineContent } from '@modules/question-bank';
import type { Locale } from '@shared/kernel';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import {
  type ThreadCommand,
  type ThreadEvent,
  ThreadRules,
  type ThreadRoundState,
} from '../../domain/games/thread-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { ThreadGameSettings } from '../battle-settings';
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

// Wrong names a bot may pick from: the most popular entities of the room's kind (08 §17.5).
const BOT_DECOY_POOL_SIZE = 30;
// Once the first letter is out, a bot that did not know the answer gets this much more chance to find it.
const BOT_HINT_BONUS = 0.3;

type Room = Extract<EngineContent['body'], { gameType: 'THREAD' }>['rooms'][number];

/** A الخيط thread (08 §17): the rules decide, this shell judges each room's slot, words events and plays the bot. */
export class ThreadRoundRunner implements RoundRunner {
  private readonly rules: ThreadRules;
  private state: ThreadRoundState | null = null;
  private readonly names: EntityNames = new Map();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: ThreadGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new ThreadRules({
      roundMs: settings.roundMs,
      lockoutMs: settings.lockoutMs,
      hint: settings.hint,
      jump: settings.jump,
      timeUp: settings.timeUp,
      latencyGraceMs,
      points: settings.points,
    });
  }

  private get rooms(): Room[] {
    if (this.content.body.gameType !== 'THREAD') throw new Error('A thread runner needs thread content');
    return this.content.body.rooms;
  }

  /** The one accepted entity of each room, in room order. */
  private answerOf(slot: number): string | null {
    return this.content.acceptedAnswers.find((answer) => answer.slot === slot)?.entityIds[0] ?? null;
  }

  async start(): Promise<void> {
    const answers = this.rooms.map((_, slot) => this.answerOf(slot)).filter((id): id is string => id !== null);
    await this.ensureNames(answers);
    const now = this.host.now();
    const step = this.rules.startRound(this.roundNo, this.host.activeParticipantIds(), this.rooms.length, now);
    this.state = step.state;
    await this.host.emit('round:start', (viewer) => ({
      roundNo: this.roundNo,
      gameType: this.host.gameType,
      roomCount: this.rooms.length,
      room: this.roomFor(viewer, step.state),
      roundDeadlineAt: step.state.deadline.toISOString(),
      jumpsLeft: step.state.progress[viewer.id]?.jumpsLeft ?? 0,
    }));
    await this.applyEffects(step.effects);
    for (const id of step.state.participants) this.scheduleBotTry(id, false);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    const now = this.host.now();
    if (command.type === 'THREAD_JUMP') {
      const result = this.rules.handleCommand(this.state, from, { type: 'THREAD_JUMP', room: command.room }, now);
      if (isRejection(result)) return result.code;
      this.state = result.state;
      await this.applyEffects(result.effects);
      const slot = this.rules.targetSlotOf(result.state, from);
      return { accepted: true, data: { question: this.jumpTextOf(command.room, this.localeOf(from)) ?? '', slot } };
    }
    if (command.type !== 'THREAD_ANSWER') return 'WRONG_GAME_TYPE';
    const early = this.rules.findAnswerRejection(this.state, from, command.room, now);
    if (early) return early.code;
    const slot = this.rules.targetSlotOf(this.state, from);
    if (slot === null) return 'INVALID_STATE';
    const judged = await this.judge(command.answer, slot, command.room);
    if (typeof judged === 'string') return judged;
    const result = this.rules.handleCommand(this.state, from, judged, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    if (judged.type !== 'THREAD_ANSWER') return null;
    return {
      accepted: true,
      data: judged.right
        ? { result: 'RIGHT' }
        : { result: 'WRONG', lockedUntil: this.rules.lockedUntilOf(result.state, from, now)?.toISOString() ?? null },
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
      roomCount: this.rooms.length,
      ...(state
        ? {
            room: this.roomFor(viewer, state),
            jumpsLeft: state.progress[viewer.id]?.jumpsLeft ?? 0,
            lockedUntil: this.rules.lockedUntilOf(state, viewer.id, this.host.now())?.toISOString() ?? null,
            rooms: Object.fromEntries(state.participants.map((id) => [id, state.progress[id]?.room ?? 0])),
            roundDeadlineAt: state.deadline.toISOString(),
            phase: state.phase,
          }
        : {}),
    };
  }

  /** Bots send the entity id itself; a typed text is judged against the slot's one answer (08 §5.3). */
  private async judge(
    answer: { text: string } | BotAnswer,
    slot: number,
    room: number,
  ): Promise<ThreadCommand | string> {
    if ('entityId' in answer) {
      return {
        type: 'THREAD_ANSWER',
        room,
        answer: { entityId: answer.entityId },
        right: answer.entityId === this.answerOf(slot),
      };
    }
    const judgement = await this.host.checker.judgeTypedText(
      this.content.contentId,
      slot,
      answer.text,
      this.host.answerRules,
    );
    if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
    if (judgement.entityId) await this.ensureNames([judgement.entityId]);
    return {
      type: 'THREAD_ANSWER',
      room,
      answer: { entityId: judgement.entityId, text: answer.text, match: judgement.match },
      right: judgement.verdict === 'CORRECT',
    };
  }

  private async applyEffects(effects: Effect<ThreadEvent>[]): Promise<void> {
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

  private async emitEvent(event: ThreadEvent): Promise<void> {
    switch (event.type) {
      case 'PROGRESSED': {
        const state = this.state;
        // The mover also gets the question of their new room; the others see the room number only.
        await this.host.emit('thread:progress', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          room: event.room,
          jumped: event.jumped,
          ...(viewer.id === event.participantId && state && event.room < this.rooms.length
            ? { question: this.roomFor(viewer, state) }
            : {}),
        }));
        this.scheduleBotTry(event.participantId, false);
        return;
      }
      case 'LOCKED':
        await this.host.emit('thread:locked', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          lockedUntil: event.lockedUntil.toISOString(),
          ...(this.settings.showWrongAnswers && event.entityId
            ? { entity: entityRef(this.names, event.entityId, viewer) }
            : {}),
        }));
        return;
      case 'JUMPED':
        await this.host.emit('thread:jumped', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          room: event.room,
        }));
        return;
      case 'HINTED':
        await this.host.emit('thread:hint', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          room: event.room,
          ...(viewer.id === event.participantId ? { letter: this.letterOf(event.slot, viewer.locale) } : {}),
        }));
        this.scheduleBotTry(event.participantId, true);
        return;
    }
  }

  /** The viewer's current room: its number, its question (the jump question while jumping) and the hint. */
  private roomFor(viewer: LiveParticipant, state: ThreadRoundState): Record<string, unknown> | null {
    const progress = state.progress[viewer.id];
    if (!progress || progress.room >= this.rooms.length) return null;
    const slot = this.rules.targetSlotOf(state, viewer.id) ?? progress.room;
    return {
      room: progress.room,
      question: progress.jumping
        ? (this.jumpTextOf(progress.room, viewer.locale) ?? '')
        : (this.rooms[progress.room]?.text[viewer.locale] ?? ''),
      jumping: progress.jumping,
      hintAt: progress.hinted
        ? null
        : new Date(progress.enteredAt.getTime() + this.settings.hint.afterMs).toISOString(),
      ...(progress.hinted ? { letter: this.letterOf(slot, viewer.locale) } : {}),
    };
  }

  private jumpTextOf(room: number, locale: Locale): string | null {
    const jumpText = this.rooms[room]?.jumpText;
    return jumpText ? (jumpText[locale] ?? jumpText.en ?? null) : null;
  }

  /** The first letter of a slot's answer in the viewer's language. */
  private letterOf(slot: number, locale: Locale): string {
    const answer = this.answerOf(slot);
    const name = answer ? (this.names.get(answer)?.[locale] ?? '') : '';
    return [...name][0] ?? '';
  }

  private localeOf(participantId: ParticipantId): Locale {
    return this.host.participants().find((participant) => participant.id === participantId)?.locale ?? 'en';
  }

  /** Every room with its question and answer, and how far each player got. */
  private buildReveal(viewer: LiveParticipant): Record<string, unknown> {
    const state = this.state;
    return {
      rooms: this.rooms.map((room, slot) => {
        const answer = this.answerOf(slot);
        return {
          room: slot,
          hop: room.hop,
          question: room.text[viewer.locale] ?? '',
          ...(answer ? { answer: entityRef(this.names, answer, viewer) } : {}),
        };
      }),
      reached: state ? Object.fromEntries(state.participants.map((id) => [id, state.progress[id]?.room ?? 0])) : {},
    };
  }

  private async ensureNames(ids: readonly string[]): Promise<void> {
    const missing = ids.filter((id) => !this.names.has(id));
    for (const [id, names] of await loadEntityNames(this.host.catalog, missing)) this.names.set(id, names);
  }

  // ---- bot (08 §17.5) ----

  /**
   * After `typingDelayMs` in a room, a bot names the room's answer with its chance at the thread's difficulty (more
   * once the hint is out); otherwise now and then a wrong popular name, or it waits for the hint. It never jumps.
   */
  private scheduleBotTry(participantId: ParticipantId, afterHint: boolean): void {
    const bot = this.host.participants().find((participant) => participant.id === participantId)?.bot;
    const state = this.state;
    if (!bot || !state || state.phase === 'CLOSED') return;
    const room = state.progress[participantId]?.room;
    if (room === undefined || room >= this.rooms.length) return;
    const { min, max } = bot.profile.typingDelayMs;
    const at = new Date(this.host.now().getTime() + randomIntegerBetween(this.host.random, min, max));
    this.host.schedule(`bot-try:${participantId}`, at, async () => {
      const current = this.state;
      if (!current || current.phase === 'CLOSED' || current.progress[participantId]?.room !== room) return;
      const slot = this.rules.targetSlotOf(current, participantId);
      const answer = slot === null ? null : this.answerOf(slot);
      if (slot === null || answer === null) return;
      const difficulty = Math.min(Math.max(this.content.difficulty, 1), 5);
      const chance = Math.min(
        1,
        bot.profile.knowsAnswerByDifficulty[difficulty - 1] + (afterHint ? BOT_HINT_BONUS : 0),
      );
      if (this.host.random.next() < chance) {
        await this.handleCommand(participantId, { type: 'THREAD_ANSWER', room, answer: { entityId: answer } });
        return;
      }
      if (this.host.random.next() >= bot.profile.guessChance) return;
      const kind = this.rooms[slot]?.answerKind ?? 'PLAYER';
      const decoys = await this.host.catalog.findDecoyEntityIds(kind, [answer], BOT_DECOY_POOL_SIZE);
      const decoy = decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
      if (decoy) await this.handleCommand(participantId, { type: 'THREAD_ANSWER', room, answer: { entityId: decoy } });
    });
  }
}
