import type { EngineContent } from '@modules/question-bank';
import type { Locale } from '@shared/kernel';
import { type BotRoundPlan, planBotRound } from '../../domain/bots/reveal-and-buzz-bot';
import { type Effect, isRejection, type JudgedAnswer, type ParticipantId } from '../../domain/games/game-rules';
import {
  type AnswerVerdict,
  type RevealCommand,
  type RevealEvent,
  type RevealRoundState,
  RevealAndBuzzRules,
} from '../../domain/games/reveal-and-buzz-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { RevealGameSettings } from '../battle-settings';
import { listEntityIdsShownInSteps, revealStepsForLocale } from '../reveal-steps';
import {
  type BotAnswer,
  type EntityNames,
  entityRef,
  loadEntityNames,
  type PlayerAnswer,
  type PlayerCommand,
  type RoundHost,
  type RoundRunner,
} from './round-runner';

// How many wrong answers a bot picks from when it answers wrong.
const BOT_DECOY_POOL_SIZE = 30;

interface BotRound {
  plan: BotRoundPlan;
  status: 'WAITING' | 'SCHEDULED' | 'DONE';
}

/** A reveal-and-buzz round: BUZZER, CAREER, WHO_IS_PLAYER (08 §3.1). */
export class RevealRoundRunner implements RoundRunner {
  private readonly rules: RevealAndBuzzRules;
  private state: RevealRoundState | null = null;
  private stepsByLocale: Partial<Record<Locale, string[]>> = {};
  private names: EntityNames = new Map();
  private readonly bots = new Map<ParticipantId, BotRound>();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: RevealGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new RevealAndBuzzRules({ ...settings, latencyGraceMs });
  }

  async start(): Promise<void> {
    const locales = [...new Set(this.host.participants().map((participant) => participant.locale))];
    const acceptedIds = this.content.acceptedAnswers.flatMap((slot) => slot.entityIds);
    this.names = await loadEntityNames(this.host.catalog, [
      ...acceptedIds,
      ...listEntityIdsShownInSteps(this.content.body),
    ]);
    const showYears = { showYears: this.settings.showYears ?? true };
    this.stepsByLocale = Object.fromEntries(
      locales.map((locale) => [locale, revealStepsForLocale(this.content.body, this.names, locale, showYears)]),
    );
    const stepCount = this.stepsByLocale[locales[0]]?.length ?? 0;
    for (const participant of this.host.participants()) {
      if (!participant.bot || participant.forfeited) continue;
      const plan = planBotRound(participant.bot.profile, this.content.difficulty, stepCount, this.host.random);
      this.bots.set(participant.id, { plan, status: plan.buzzAfterStep === null ? 'DONE' : 'WAITING' });
    }
    const step = this.rules.startRound(this.roundNo, stepCount, this.host.activeParticipantIds(), this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<string | null> {
    if (command.type === 'BUZZ') return this.applyRevealCommand(from, { type: 'BUZZ' });
    if (command.type === 'ANSWER') return this.judgeAndApplyAnswer(from, command.answer);
    return 'WRONG_GAME_TYPE';
  }

  async participantLeft(who: ParticipantId): Promise<void> {
    if (!this.state) return;
    const step = this.rules.participantLeft(this.state, who, this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  snapshotFor(viewer: Parameters<RoundRunner['snapshotFor']>[0]): Record<string, unknown> {
    const state = this.state;
    if (!state) return { roundNo: this.roundNo };
    return {
      roundNo: this.roundNo,
      phase: state.phase,
      stepCount: state.stepCount,
      revealedClues: (this.stepsByLocale[viewer.locale] ?? []).slice(0, state.stepsRevealed),
      buzzHolder: state.buzzHolder,
      lockedOut: state.participants.filter((id) => this.rules.isLockedOut(state, id)),
      deadlines: {
        answerDeadlineAt: state.answerDeadlineAt?.toISOString() ?? null,
        nextClueAt: state.phase === 'REVEALING' ? (state.nextDeadlineAt?.toISOString() ?? null) : null,
      },
    };
  }

  private async applyRevealCommand(from: ParticipantId, command: RevealCommand): Promise<string | null> {
    if (!this.state) return 'INVALID_STATE';
    const result = this.rules.handleCommand(this.state, from, command, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    return null;
  }

  private async judgeAndApplyAnswer(from: ParticipantId, answer: PlayerAnswer | BotAnswer): Promise<string | null> {
    if (!this.state) return 'INVALID_STATE';
    const rejection = this.rules.findAnswerRejection(this.state, from, this.host.now());
    if (rejection) return rejection.code;
    const judged = await this.judgeAnswer(answer);
    if (typeof judged === 'string') return judged;
    return this.applyRevealCommand(from, { type: 'ANSWER', ...judged });
  }

  /** The judged answer and its verdict, or the ack's error code. */
  private async judgeAnswer(
    answer: PlayerAnswer | BotAnswer,
  ): Promise<{ answer: JudgedAnswer; verdict: AnswerVerdict } | string> {
    const { body, answerKind, contentId } = this.content;
    // The round told the client its answerKind, so a number for a name (or the reverse) is a malformed payload.
    if ('number' in answer !== (answerKind === 'NUMBER')) return 'INVALID_PAYLOAD';
    if ('number' in answer) {
      const correct = body.gameType === 'BUZZER' && body.answerNumber === answer.number;
      return { answer, verdict: correct ? 'CORRECT' : 'WRONG' };
    }
    if ('entityId' in answer) {
      const accepted = this.content.acceptedAnswers.find((slot) => slot.slot === 0)?.entityIds ?? [];
      return { answer, verdict: accepted.includes(answer.entityId) ? 'CORRECT' : 'WRONG' };
    }
    const judgement = await this.host.checker.judgeTypedText(contentId, 0, answer.text, this.host.answerRules);
    if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
    return {
      answer: { entityId: judgement.entityId, text: answer.text, match: judgement.match },
      verdict: judgement.verdict,
    };
  }

  private async applyEffects(effects: Effect<RevealEvent>[]): Promise<void> {
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
          await this.host.endRound(effect.result, (viewer) => this.revealFor(viewer));
          return;
      }
    }
    this.scheduleBotBuzzes();
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer, this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private revealFor(viewer: Parameters<RoundRunner['snapshotFor']>[0]): Record<string, unknown> {
    const { body } = this.content;
    const answerId = this.content.acceptedAnswers[0]?.entityIds[0];
    return {
      steps: this.stepsByLocale[viewer.locale] ?? [],
      answer:
        body.gameType === 'BUZZER' && body.answerNumber !== null
          ? { number: body.answerNumber }
          : answerId
            ? entityRef(this.names, answerId, viewer)
            : null,
      ...(body.gameType === 'BUZZER' && body.explanation?.[viewer.locale]
        ? { explanation: body.explanation[viewer.locale] }
        : {}),
    };
  }

  private async emitEvent(event: RevealEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        return this.host.emit('round:start', () => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          answerKind: this.content.answerKind,
          stepCount: event.stepCount,
        }));
      case 'CLUE_REVEALED':
        return this.host.emit('round:clue', (viewer) => ({
          roundNo: event.roundNo,
          index: event.index,
          clue: this.stepsByLocale[viewer.locale]?.[event.index - 1] ?? '',
          nextClueAt: event.nextClueAt?.toISOString() ?? null,
        }));
      case 'BUZZED':
        this.scheduleBotAnswer(event.participantId);
        return this.host.emit('round:buzzed', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          answerDeadlineAt: event.answerDeadlineAt.toISOString(),
        }));
      case 'WRONG_ANSWER': {
        // Only a named entity or a number is shown: the typed text never reaches other players (ADR-0021).
        const answer = event.answer;
        const shownEntityId = answer && 'entityId' in answer ? answer.entityId : null;
        const names = shownEntityId
          ? await loadEntityNames(this.host.catalog, [shownEntityId])
          : (new Map() as EntityNames);
        return this.host.emit('round:wrong', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          ...(shownEntityId ? { answer: entityRef(names, shownEntityId, viewer) } : {}),
          ...(answer && 'number' in answer ? { answer: { number: answer.number } } : {}),
          timedOut: event.timedOut,
        }));
      }
      case 'RESUMED':
        return this.host.emit('round:resumed', () => ({
          roundNo: event.roundNo,
          nextClueAt: event.nextClueAt?.toISOString() ?? null,
        }));
    }
  }

  // ---- bots (08 §3.3) ----

  /** A bot buzzes a little after its planned step is out, if the buzzer is free and it is not locked out. */
  private scheduleBotBuzzes(): void {
    const state = this.state;
    if (!state || state.phase === 'CLOSED' || state.phase === 'ANSWERING') return;
    for (const [botId, bot] of this.bots) {
      if (bot.status !== 'WAITING' || state.stepsRevealed < (bot.plan.buzzAfterStep ?? Infinity)) continue;
      const profile = this.host.participants().find((participant) => participant.id === botId)?.bot?.profile;
      if (!profile) continue;
      bot.status = 'SCHEDULED';
      const delay = randomIntegerBetween(this.host.random, profile.reactionDelayMs.min, profile.reactionDelayMs.max);
      this.host.schedule(`bot-buzz:${botId}`, new Date(this.host.now().getTime() + delay), async () => {
        const code = await this.applyRevealCommand(botId, { type: 'BUZZ' });
        // Someone else holds the buzzer: try again when the reveal resumes.
        bot.status = code === 'BUZZ_TAKEN' ? 'WAITING' : 'DONE';
      });
    }
  }

  private scheduleBotAnswer(buzzerId: ParticipantId): void {
    const bot = this.bots.get(buzzerId);
    if (!bot) return;
    const at = new Date(this.host.now().getTime() + bot.plan.typingDelayMs);
    this.host.schedule(`bot-answer:${buzzerId}`, at, async () => {
      const answer = await this.chooseBotAnswer(bot.plan.answersCorrectly);
      if (answer) await this.judgeAndApplyAnswer(buzzerId, answer);
    });
  }

  private async chooseBotAnswer(correct: boolean): Promise<{ number: number } | BotAnswer | null> {
    const { content } = this;
    const accepted = content.acceptedAnswers.flatMap((slot) => slot.entityIds);
    if (content.answerKind === 'NUMBER') {
      const number = content.body.gameType === 'BUZZER' ? content.body.answerNumber : null;
      if (number === null) return null;
      return { number: correct ? number : number + randomIntegerBetween(this.host.random, 1, 3) };
    }
    if (correct) return accepted[0] ? { entityId: accepted[0] } : null;
    const decoys = await this.host.catalog.findDecoyEntityIds(content.answerKind, accepted, BOT_DECOY_POOL_SIZE);
    if (decoys.length === 0) return null;
    return { entityId: decoys[randomIntegerBetween(this.host.random, 0, decoys.length - 1)] };
  }
}
