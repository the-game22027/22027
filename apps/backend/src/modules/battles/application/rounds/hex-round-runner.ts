import { convertToMatchingForm, type EngineContent } from '@modules/question-bank';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import { type HexCommand, type HexEvent, HexRules, type HexRoundState } from '../../domain/games/hex-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { HexGameSettings } from '../battle-settings';
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

// The other right names shown after a race, per viewer (08 §13.1 step 9).
const RIGHT_NAMES_SHOWN = 5;
// The bot clears a cell when the opponent needs at most this many more cells (08 §13.6).
const BOT_CLEAR_WHEN_OPPONENT_NEEDS = 2;

/** A الهجمة board (08 §13). */
export class HexRoundRunner implements RoundRunner {
  private readonly rules: HexRules;
  private state: HexRoundState | null = null;
  private readonly names: EntityNames = new Map();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: HexGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new HexRules({
      pickMs: settings.pickMs,
      answerMs: settings.answerMs,
      lockoutMs: settings.lockoutMs,
      maxPicks: settings.maxPicks,
      latencyGraceMs,
      showWrongAnswers: settings.showWrongAnswers,
      points: settings.points,
    });
  }

  private get body() {
    if (this.content.body.gameType !== 'HEX') throw new Error('A hex runner needs hex content');
    return this.content.body;
  }

  private get questionsPerCell(): number {
    return this.body.cells[0]?.questions.length ?? 1;
  }

  async start(): Promise<void> {
    const players = this.host.activeParticipantIds();
    const firstPicker = this.host.firstMoverId ?? players[Math.floor(this.host.random.next() * players.length)];
    const handedOn = (this.host.carryOver as { clearsLeft?: Record<string, number> } | undefined)?.clearsLeft;
    const clearsLeft = Object.fromEntries(
      players.map((id) => [id, handedOn?.[id] ?? this.settings.clear.usesPerBattle]),
    );
    const listIds = this.content.acceptedAnswers.flatMap((answer) => answer.entityIds);
    for (const [id, names] of await loadEntityNames(this.host.catalog, listIds)) this.names.set(id, names);
    const step = this.rules.startRound({
      roundNo: this.roundNo,
      participants: players,
      size: this.body.size,
      questionsPerCell: this.questionsPerCell,
      firstPicker: firstPicker ?? players[0] ?? '',
      clearsLeft,
      now: this.host.now(),
    });
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    switch (command.type) {
      case 'HEX_PICK':
        return this.applyCommand(from, { type: 'HEX_PICK', cell: command.cell, clear: command.clear });
      case 'HEX_ANSWER': {
        const problem = this.rules.findAnswerRejection(this.state, from, this.host.now());
        if (problem) return problem.code;
        const judged = await this.judgeForCell(from, command.answer, this.state);
        if (typeof judged === 'string') return judged;
        return this.applyCommand(from, { type: 'HEX_ANSWER', ...judged });
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
    const now = this.host.now();
    return {
      roundNo: this.roundNo,
      size: this.body.size,
      board: this.lettersFor(viewer),
      ...(state
        ? {
            owners: state.owners,
            sides: state.sides,
            phase: state.phase,
            turnOf: state.turnOf,
            racingCell: state.racingCell,
            ...(state.racingCell !== null ? this.raceTextFor(viewer, state, state.racingCell) : {}),
            lockedUntil: Object.fromEntries(
              state.participants.map((id) => [id, this.rules.lockedUntilOf(state, id, now)?.toISOString() ?? null]),
            ),
            clearsLeft: state.clearsLeft,
            picks: state.picks,
            deadline: state.deadline.toISOString(),
          }
        : {}),
    };
  }

  /**
   * The verdict for the racing cell (08 §13.1 step 4): a name of its current list whose typed text starts with
   * the cell's letter in the player's language. A right name with another first letter is refused, not wrong.
   */
  private async judgeForCell(
    from: ParticipantId,
    answer: { text: string } | BotAnswer,
    state: HexRoundState,
  ): Promise<Pick<Extract<HexCommand, { type: 'HEX_ANSWER' }>, 'answer' | 'correct'> | string> {
    const cell = state.racingCell ?? 0;
    const slot = this.slotOf(state, cell);
    const list = this.listOfSlot(slot);
    const letter = this.letterOf(cell, this.localeOf(from));
    if ('entityId' in answer) {
      return {
        answer,
        correct: list.includes(answer.entityId) && this.hasNameStartingWith(answer.entityId, from, letter),
      };
    }
    const judgement = await this.host.checker.judgeTypedText(
      this.content.contentId,
      slot,
      answer.text,
      this.host.answerRules,
      [],
    );
    if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
    const right = judgement.verdict === 'CORRECT';
    if (right && !convertToMatchingForm(answer.text).startsWith(letter)) return 'WRONG_LETTER';
    return { answer: { entityId: judgement.entityId, text: answer.text }, correct: right };
  }

  private async applyCommand(from: ParticipantId, command: HexCommand): Promise<string | null> {
    if (!this.state) return 'INVALID_STATE';
    const result = this.rules.handleCommand(this.state, from, command, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    return null;
  }

  private async applyEffects(effects: Effect<HexEvent>[]): Promise<void> {
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
          await this.host.endRound(effect.result, () => this.buildReveal());
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

  private async emitEvent(event: HexEvent): Promise<void> {
    const state = this.state;
    switch (event.type) {
      case 'ROUND_STARTED':
        this.scheduleBotPick(event.firstPicker);
        return this.host.emit('round:start', (viewer) => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          size: this.body.size,
          board: this.lettersFor(viewer),
          sides: event.sides,
          firstPickerParticipantId: event.firstPicker,
          pickDeadlineAt: event.pickDeadlineAt.toISOString(),
          clearsLeft: event.clearsLeft,
        }));
      case 'TURN':
        this.scheduleBotPick(event.participantId);
        return this.host.emit('hex:turn', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          pickDeadlineAt: event.pickDeadlineAt.toISOString(),
        }));
      case 'RACE':
        this.scheduleBotAnswers(event.cell);
        return this.host.emit('hex:race', (viewer) => ({
          roundNo: event.roundNo,
          cell: event.cell,
          pickedBy: event.pickedBy,
          auto: event.auto,
          cleared: event.cleared,
          ...(state ? this.raceTextFor(viewer, state, event.cell) : {}),
          answerDeadlineAt: event.answerDeadlineAt.toISOString(),
        }));
      case 'ANSWERED': {
        const entityId = event.entityId;
        if (entityId && !this.names.has(entityId)) {
          for (const [id, names] of await loadEntityNames(this.host.catalog, [entityId])) this.names.set(id, names);
        }
        return this.host.emit('hex:answered', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          ...(entityId ? { player: entityRef(this.names, entityId, viewer) } : {}),
          lockedUntil: event.lockedUntil.toISOString(),
        }));
      }
      case 'CLAIMED':
        return this.host.emit('hex:claimed', (viewer) => ({
          roundNo: event.roundNo,
          cell: event.cell,
          participantId: event.participantId,
          player: entityRef(this.names, event.entityId, viewer),
          rightNames: this.rightNamesFor(viewer, event.cell, event.entityId),
        }));
      case 'EXPIRED':
        return this.host.emit('hex:expired', (viewer) => ({
          roundNo: event.roundNo,
          cell: event.cell,
          rightNames: this.rightNamesFor(viewer, event.cell, null),
        }));
    }
  }

  private lettersFor(viewer: LiveParticipant): string[] {
    return this.body.cells.map((cell) => cell.letter[viewer.locale] ?? Object.values(cell.letter)[0] ?? '');
  }

  private raceTextFor(viewer: LiveParticipant, state: HexRoundState, cell: number) {
    const question = this.body.cells[cell]?.questions[state.questionOf[cell] ?? 0];
    return {
      question: question?.title[viewer.locale] ?? '',
      letter: this.lettersFor(viewer)[cell] ?? '',
    };
  }

  /**
   * After a race, the right names of the question just raced, for this viewer's letter. The race moved the cell
   * to its next question already, so the one raced is the previous one.
   */
  private rightNamesFor(viewer: LiveParticipant, cell: number, takenBy: string | null) {
    const state = this.state;
    if (!state) return [];
    const raced = (state.questionOf[cell] ?? 0) - 1;
    const slot = cell * this.questionsPerCell + ((raced + this.questionsPerCell) % this.questionsPerCell);
    const letter = this.letterOf(cell, viewer.locale);
    return this.listOfSlot(slot)
      .filter((id) => id !== takenBy && this.nameWordsOf(id, viewer.locale).some((word) => word.startsWith(letter)))
      .slice(0, RIGHT_NAMES_SHOWN)
      .map((id) => entityRef(this.names, id, viewer));
  }

  private buildReveal(): Record<string, unknown> {
    const state = this.state;
    if (!state) return {};
    return { outcome: state.outcome, ...(state.path.length > 0 ? { path: state.path } : {}), owners: state.owners };
  }

  private slotOf(state: HexRoundState, cell: number): number {
    return cell * this.questionsPerCell + (state.questionOf[cell] ?? 0);
  }

  private listOfSlot(slot: number): string[] {
    return this.content.acceptedAnswers.find((answer) => answer.slot === slot)?.entityIds ?? [];
  }

  private letterOf(cell: number, locale: string): string {
    const letter = this.body.cells[cell]?.letter;
    return convertToMatchingForm(letter?.[locale as 'en' | 'ar'] ?? Object.values(letter ?? {})[0] ?? '');
  }

  private localeOf(participantId: ParticipantId): string {
    return this.host.participants().find((participant) => participant.id === participantId)?.locale ?? 'en';
  }

  private nameWordsOf(entityId: string, locale: string): string[] {
    const name = this.names.get(entityId)?.[locale as 'en' | 'ar'] ?? '';
    return convertToMatchingForm(name).split(' ').filter(Boolean);
  }

  private hasNameStartingWith(entityId: string, participantId: ParticipantId, letter: string): boolean {
    return this.nameWordsOf(entityId, this.localeOf(participantId)).some((word) => word.startsWith(letter));
  }

  // ---- bot (08 §13.6) ----

  private botOf(participantId: ParticipantId) {
    return this.host.participants().find((participant) => participant.id === participantId)?.bot ?? null;
  }

  private delayFor(bot: NonNullable<LiveParticipant['bot']>): Date {
    const { min, max } = bot.profile.typingDelayMs;
    return new Date(this.host.now().getTime() + randomIntegerBetween(this.host.random, min, max));
  }

  private scheduleBotPick(participantId: ParticipantId): void {
    const bot = this.botOf(participantId);
    if (!bot) return;
    this.host.schedule(`bot-pick:${participantId}`, this.delayFor(bot), async () => {
      const state = this.state;
      if (state?.phase !== 'PICKING' || state.turnOf !== participantId) return;
      const opponent = state.participants.find((id) => id !== participantId);
      const theirPath = opponent ? this.rules.findShortestPathFor(state, opponent) : [];
      const theirOpenCells = theirPath.filter((cell) => state.owners[cell] === null);
      const theirOwnedCell = theirPath.find((cell) => state.owners[cell] === opponent);
      if (
        (state.clearsLeft[participantId] ?? 0) > 0 &&
        theirPath.length > 0 &&
        theirOpenCells.length <= BOT_CLEAR_WHEN_OPPONENT_NEEDS &&
        theirOwnedCell !== undefined
      ) {
        await this.handleCommand(participantId, { type: 'HEX_PICK', cell: theirOwnedCell, clear: true });
        return;
      }
      const mine = this.rules.findShortestPathFor(state, participantId).filter((cell) => state.owners[cell] === null);
      const open = state.owners.flatMap((owner, cell) => (owner === null ? [cell] : []));
      const cell = mine[0] ?? open[Math.floor(this.host.random.next() * open.length)];
      if (cell !== undefined) await this.handleCommand(participantId, { type: 'HEX_PICK', cell, clear: false });
    });
  }

  private scheduleBotAnswers(cell: number): void {
    for (const participant of this.host.participants()) {
      const bot = participant.bot;
      if (!bot) continue;
      this.host.schedule(`bot-answer:${participant.id}`, this.delayFor(bot), async () => {
        const state = this.state;
        if (state?.phase !== 'RACING' || state.racingCell !== cell) return;
        const chance = bot.profile.knowsAnswerByDifficulty[Math.min(Math.max(this.content.difficulty, 1), 5) - 1];
        if (this.host.random.next() >= chance) return;
        const letter = this.letterOf(cell, participant.locale);
        const known = this.listOfSlot(this.slotOf(state, cell)).find((id) =>
          this.hasNameStartingWith(id, participant.id, letter),
        );
        if (known) await this.handleCommand(participant.id, { type: 'HEX_ANSWER', answer: { entityId: known } });
      });
    }
  }
}
