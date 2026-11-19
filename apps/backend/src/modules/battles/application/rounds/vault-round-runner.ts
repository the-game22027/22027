import type { EngineContent } from '@modules/question-bank';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import { type VaultEvent, VaultRules, type VaultRoundState } from '../../domain/games/vault-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { VaultGameSettings } from '../battle-settings';
import type { LiveParticipant } from '../live-participant';
import type { PlayerCommand, RoundCommandOutcome, RoundHost, RoundRunner } from './round-runner';

// A bot tries the code once at most this many digits are still unknown to it; it guesses those (08 §12.5).
const BOT_MAX_GUESS_DIGITS = 1;

/** A الخزنة round (08 §12). */
export class VaultRoundRunner implements RoundRunner {
  private readonly rules: VaultRules;
  private state: VaultRoundState | null = null;
  /** Per bot: the positions it knows, and the values it already tried at each unknown position. */
  private readonly botKnowledge = new Map<ParticipantId, { known: Set<number>; tried: Map<number, Set<number>> }>();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    settings: VaultGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new VaultRules({
      roundMs: settings.roundMs,
      lockoutMs: settings.lockoutMs,
      leaks: settings.leaks,
      latencyGraceMs,
      points: settings.points,
    });
  }

  private get body() {
    if (this.content.body.gameType !== 'VAULT') throw new Error('A vault runner needs vault content');
    return this.content.body;
  }

  async start(): Promise<void> {
    const code = this.body.questions.map((question) => question.answerNumber);
    const step = this.rules.startRound(this.roundNo, this.host.activeParticipantIds(), code, this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    if (command.type !== 'VAULT_TRY') return 'WRONG_GAME_TYPE';
    const now = this.host.now();
    const result = this.rules.handleCommand(this.state, from, { type: 'VAULT_TRY', code: command.code }, now);
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    if (result.state.phase === 'CLOSED') return null;
    // A wrong try: only the player who tried learns it, and when they may try again (08 §12.3).
    return {
      accepted: true,
      data: {
        opened: false,
        lockedUntil: this.rules.lockedUntilOf(result.state, from, now)?.toISOString() ?? null,
        tries: result.state.tries[from] ?? 0,
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
    const now = this.host.now();
    return {
      roundNo: this.roundNo,
      questions: this.questionsFor(viewer),
      digits: this.body.questions.length,
      ...(state
        ? {
            leaked: this.leakedDigits(state),
            tries: state.tries,
            lockedUntil: this.rules.lockedUntilOf(state, viewer.id, now)?.toISOString() ?? null,
            roundDeadlineAt: state.deadline.toISOString(),
            nextLeakAt: state.phase === 'OPEN' ? (this.rules.findNextLeakAt(state)?.toISOString() ?? null) : null,
          }
        : {}),
    };
  }

  private async applyEffects(effects: Effect<VaultEvent>[]): Promise<void> {
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
    const step = this.rules.handleTimer(this.state, timer, this.host.random);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async emitEvent(event: VaultEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        this.prepareBots();
        await this.host.emit('round:start', (viewer) => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          questions: this.questionsFor(viewer),
          digits: event.digits,
          roundDeadlineAt: event.roundDeadlineAt.toISOString(),
          firstLeakAt: event.firstLeakAt?.toISOString() ?? null,
        }));
        this.scheduleBotTries();
        return;
      case 'TRIED':
        return this.host.emit('vault:tried', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          tries: event.tries,
        }));
      case 'LEAKED':
        await this.host.emit('vault:leak', () => ({
          roundNo: event.roundNo,
          position: event.position,
          digit: event.digit,
          nextLeakAt: event.nextLeakAt?.toISOString() ?? null,
        }));
        this.scheduleBotTries();
        return;
    }
  }

  private questionsFor(viewer: LiveParticipant): string[] {
    return this.body.questions.map((question) => question.text[viewer.locale] ?? Object.values(question.text)[0] ?? '');
  }

  private leakedDigits(state: VaultRoundState): { position: number; digit: number }[] {
    return state.leaked.map((position) => ({ position, digit: state.code[position] ?? 0 }));
  }

  /** The code and every answer, so both players learn the facts they missed (08 §12.1 step 8). */
  private buildReveal(): Record<string, unknown> {
    const state = this.state;
    if (!state) return {};
    return {
      code: state.code.join(''),
      outcome: state.openedBy ? 'OPENED' : 'NOBODY',
      ...(state.openedBy ? { openedBy: state.openedBy } : {}),
      answers: state.code.map((digit, position) => ({ position, digit })),
    };
  }

  // ---- bot (08 §12.5) ----

  private prepareBots(): void {
    for (const participant of this.host.participants()) {
      const bot = participant.bot;
      if (!bot) continue;
      const chance = bot.profile.knowsAnswerByDifficulty[Math.min(Math.max(this.content.difficulty, 1), 5) - 1];
      const known = new Set(
        this.body.questions.map((_, position) => position).filter(() => this.host.random.next() < chance),
      );
      this.botKnowledge.set(participant.id, { known, tried: new Map() });
    }
  }

  private scheduleBotTries(): void {
    for (const participantId of this.botKnowledge.keys()) this.scheduleBotTry(participantId, this.host.now());
  }

  private scheduleBotTry(participantId: ParticipantId, notBefore: Date): void {
    const bot = this.host.participants().find((participant) => participant.id === participantId)?.bot;
    if (!bot) return;
    const { min, max } = bot.profile.typingDelayMs;
    const lockedUntil = this.state ? this.rules.lockedUntilOf(this.state, participantId, this.host.now()) : null;
    const from = Math.max(notBefore.getTime(), lockedUntil?.getTime() ?? 0);
    const at = new Date(from + randomIntegerBetween(this.host.random, min, max));
    this.host.schedule(`bot-try:${participantId}`, at, async () => {
      const code = this.botCodeFor(participantId);
      if (!code) return;
      const outcome = await this.handleCommand(participantId, { type: 'VAULT_TRY', code });
      if (outcome && typeof outcome === 'object' && typeof outcome.data.lockedUntil === 'string') {
        this.scheduleBotTry(participantId, new Date(outcome.data.lockedUntil));
      }
    });
  }

  /** A code to try, or null while too many digits are unknown to the bot (it waits for the next leak). */
  private botCodeFor(participantId: ParticipantId): string | null {
    const state = this.state;
    const knowledge = this.botKnowledge.get(participantId);
    if (!state || state.phase !== 'OPEN' || !knowledge) return null;
    const unknown = state.code
      .map((_, position) => position)
      .filter((position) => !knowledge.known.has(position) && !state.leaked.includes(position));
    if (unknown.length > BOT_MAX_GUESS_DIGITS) return null;
    return state.code
      .map((digit, position) => {
        if (!unknown.includes(position)) return digit;
        const tried = knowledge.tried.get(position) ?? new Set<number>();
        const guess = [...Array(10).keys()].find((value) => !tried.has(value)) ?? 0;
        knowledge.tried.set(position, tried.add(guess));
        return guess;
      })
      .join('');
  }
}
