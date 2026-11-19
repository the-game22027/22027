import type { EngineContent } from '@modules/question-bank';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import {
  isMineExploded,
  type MinesCommand,
  type MinesEvent,
  MinesRules,
  type MinesRoundState,
  minesOf,
  type MineTextAnswer,
} from '../../domain/games/mines-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { MinesGameSettings } from '../battle-settings';
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

/** What a MINES round hands to the next one (08 §10.7). */
interface MinesCarryOver {
  detectorUsesLeft: Record<ParticipantId, number>;
}

const isMinesCarryOver = (value: unknown): value is MinesCarryOver =>
  typeof value === 'object' && value !== null && 'detectorUsesLeft' in value;

/** A لغم round (08 §10). */
export class MinesRoundRunner implements RoundRunner {
  private readonly rules: MinesRules;
  private state: MinesRoundState | null = null;
  private readonly names: EntityNames = new Map();
  private readonly category: string[];

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: MinesGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new MinesRules({
      minesPerPlayer: settings.burying.minesPerPlayer,
      buryMs: settings.burying.ms,
      maxWrongBuryTries: settings.burying.maxWrongTries,
      turnMs: settings.turnMs,
      maxTurns: settings.maxTurns,
      hearts: settings.hearts,
      ownMine: settings.ownMine,
      detectorCostMs: settings.detector.costMs,
      latencyGraceMs,
      showWrongAnswers: settings.showWrongAnswers,
      points: settings.points,
    });
    this.category = content.acceptedAnswers.find((answer) => answer.slot === 0)?.entityIds ?? [];
  }

  private get body() {
    if (this.content.body.gameType !== 'MINES') throw new Error('A mines runner needs mines content');
    return this.content.body;
  }

  async start(): Promise<void> {
    const criteria = this.body.criteria.flatMap((criterion) => ('entityId' in criterion ? [criterion.entityId] : []));
    await this.rememberNames([...criteria, ...this.category]);
    const players = this.host.activeParticipantIds();
    // The first-mover phase decides (08 §9.1); without one, the battle's seeded random source does.
    const firstTurn = this.host.firstMoverId ?? players[Math.floor(this.host.random.next() * players.length)];
    const carried = isMinesCarryOver(this.host.carryOver) ? this.host.carryOver.detectorUsesLeft : {};
    const detectorUsesLeft = Object.fromEntries(
      players.map((id) => [id, carried[id] ?? this.settings.detector.usesPerBattle]),
    );
    const step = this.rules.startRound(
      this.roundNo,
      players,
      this.category,
      firstTurn,
      detectorUsesLeft,
      this.host.now(),
    );
    this.state = step.state;
    await this.applyEffects(step.effects);
    for (const participant of this.host.participants()) {
      if (participant.bot && players.includes(participant.id)) this.scheduleBotBurying(participant);
    }
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    const now = this.host.now();
    switch (command.type) {
      case 'MINE_BURY': {
        const problem = this.rules.findBuryRejection(this.state, from, null, now);
        if (problem) return problem.code;
        const judged = await this.judgeAgainstCategory(command.answer, []);
        if (typeof judged === 'string') return judged;
        const outcome = await this.applyCommand(from, { type: 'MINE_BURY', ...judged });
        return outcome ?? { accepted: true, data: this.buryAckDataFor(from) };
      }
      case 'MINE_ANSWER': {
        const problem = this.rules.findTurnRejection(this.state, from, now);
        if (problem) return problem.code;
        const judged = await this.judgeAgainstCategory(command.answer, this.state.used);
        if (typeof judged === 'string') return judged;
        return this.applyCommand(from, { type: 'MINE_ANSWER', ...judged });
      }
      case 'MINE_SCAN': {
        const problem = this.rules.findTurnRejection(this.state, from, now);
        if (problem) return problem.code;
        const judged = await this.judgeAgainstCategory(command.answer, []);
        if (typeof judged === 'string') return judged;
        return this.applyCommand(from, {
          type: 'MINE_SCAN',
          entityId: judged.inCategory ? judged.answer.entityId : null,
        });
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
      criteria: this.criteriaFor(viewer),
      answerCount: this.category.length,
      ...(state
        ? {
            phase: state.phase,
            buryDeadlineAt: state.buryDeadlineAt.toISOString(),
            yourMines: this.minesFor(state, viewer.id, viewer),
            wrongTriesLeft: this.settings.burying.maxWrongTries - (state.wrongBuryTries[viewer.id] ?? 0),
            exploded: state.participants.flatMap((buriedBy) =>
              minesOf(state, buriedBy)
                .filter((mine) => isMineExploded(state, buriedBy, mine.entityId))
                .map((mine) => ({ buriedBy, player: entityRef(this.names, mine.entityId, viewer) })),
            ),
            said: state.said.map((said) => ({
              participantId: said.participantId,
              outcome: said.outcome,
              ...(this.isSaidNameShown(said.outcome) && said.entityId
                ? { player: entityRef(this.names, said.entityId, viewer) }
                : {}),
            })),
            ...this.countsOf(state),
            turnOf: state.phase === 'TURNS' ? state.turnOf : null,
            turnNo: state.turnNo,
            detectorUsesLeft: state.detectorUsesLeft[viewer.id] ?? 0,
            deadlines: { turnDeadlineAt: state.turnDeadlineAt.toISOString() },
          }
        : {}),
    };
  }

  /** The verdict against the category, or the ack's error code. Used players lose ties to unused ones (08 §5.3). */
  private async judgeAgainstCategory(
    answer: { text: string } | BotAnswer,
    used: readonly string[],
  ): Promise<{ answer: MineTextAnswer; inCategory: boolean } | string> {
    if ('entityId' in answer) return { answer, inCategory: this.category.includes(answer.entityId) };
    const judgement = await this.host.checker.judgeTypedText(
      this.content.contentId,
      0,
      answer.text,
      this.host.answerRules,
      used,
    );
    if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
    if (judgement.entityId) await this.rememberNames([judgement.entityId]);
    return {
      answer: { entityId: judgement.entityId, text: answer.text, match: judgement.match },
      inCategory: judgement.verdict === 'CORRECT',
    };
  }

  private async applyCommand(from: ParticipantId, command: MinesCommand): Promise<string | null> {
    if (!this.state) return 'INVALID_STATE';
    const result = this.rules.handleCommand(this.state, from, command, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    return result.refusal ?? null;
  }

  private async applyEffects(effects: Effect<MinesEvent>[]): Promise<void> {
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
          const carryOver: MinesCarryOver = { detectorUsesLeft: this.state?.detectorUsesLeft ?? {} };
          await this.host.endRound({ ...effect.result, carryOver }, this.buildReveal());
          return;
        }
      }
    }
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer, this.host.now(), this.host.random);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async emitEvent(event: MinesEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        return this.host.emit('round:start', (viewer) => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          criteria: this.criteriaFor(viewer),
          answerCount: this.category.length,
          minesPerPlayer: this.settings.burying.minesPerPlayer,
          hearts: this.settings.hearts,
          buryDeadlineAt: event.buryDeadlineAt.toISOString(),
          firstTurnParticipantId: event.firstTurn,
        }));
      case 'TURN': {
        this.scheduleBotTurn(event.participantId);
        const state = this.state;
        return this.host.emit('mines:turn', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          turnNo: event.turnNo,
          turnDeadlineAt: event.turnDeadlineAt.toISOString(),
          // The first turn closes burying: each player learns their own final mines, auto ones included.
          ...(event.turnNo === 1 && state ? { yourMines: this.minesFor(state, viewer.id, viewer) } : {}),
        }));
      }
      case 'ANSWERED': {
        if (event.entityId) await this.rememberNames([event.entityId]);
        const state = this.state;
        return this.host.emit('mines:answered', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          outcome: event.outcome,
          ...(event.entityId ? { player: entityRef(this.names, event.entityId, viewer) } : {}),
          ...(event.buriedBy ? { buriedBy: event.buriedBy } : {}),
          ...(state ? this.countsOf(state) : {}),
        }));
      }
      case 'SCANNED':
        return this.host.emit('mines:scanned', (viewer) => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          turnDeadlineAt: event.turnDeadlineAt.toISOString(),
          ...(viewer.id === event.participantId ? { result: event.result } : {}),
        }));
    }
  }

  /** Hearts, unsaid answers and live mines per player: public counts (08 §10.1 step 9). */
  private countsOf(state: MinesRoundState) {
    return {
      hearts: state.participants.map((participantId) => ({ participantId, hearts: state.hearts[participantId] ?? 0 })),
      answersLeft: this.category.filter((id) => !state.used.includes(id)).length,
      minesLeft: state.participants.map((participantId) => ({
        participantId,
        minesLeft: minesOf(state, participantId).filter((mine) => !isMineExploded(state, participantId, mine.entityId))
          .length,
      })),
    };
  }

  private minesFor(state: MinesRoundState, owner: ParticipantId, viewer: LiveParticipant) {
    return minesOf(state, owner).map((mine) => ({
      player: entityRef(this.names, mine.entityId, viewer),
      auto: mine.auto,
      exploded: isMineExploded(state, owner, mine.entityId),
    }));
  }

  private buryAckDataFor(from: ParticipantId): Record<string, unknown> {
    const viewer = this.host.participants().find((participant) => participant.id === from);
    const state = this.state;
    if (!viewer || !state) return {};
    return {
      mines: this.minesFor(state, from, viewer).map(({ player, auto }) => ({ player, auto })),
      wrongTriesLeft: this.settings.burying.maxWrongTries - (state.wrongBuryTries[from] ?? 0),
    };
  }

  private isSaidNameShown(outcome: string): boolean {
    if (outcome === 'OWN_MINE' || outcome === 'TIMEOUT') return false;
    return outcome !== 'WRONG' || this.settings.showWrongAnswers;
  }

  private criteriaFor(viewer: LiveParticipant) {
    return this.body.criteria.map((criterion) =>
      'entityId' in criterion
        ? { kind: criterion.kind, entity: entityRef(this.names, criterion.entityId, viewer) }
        : criterion,
    );
  }

  /** Every mine with who buried it, and some unsaid safe players of the category (08 §10.1 step 6). */
  private buildReveal(): (viewer: LiveParticipant) => Record<string, unknown> {
    const state = this.state;
    if (!state) return () => ({});
    const mined = new Set(state.participants.flatMap((who) => minesOf(state, who).map((mine) => mine.entityId)));
    const samples = this.category
      .filter((id) => !state.used.includes(id) && !mined.has(id))
      .slice(0, this.settings.revealAnswersAtEnd);
    return (viewer) => ({
      reason: state.endReason,
      mines: state.participants.map((participantId) => ({
        participantId,
        mines: this.minesFor(state, participantId, viewer),
      })),
      sampleAnswers: samples.map((id) => entityRef(this.names, id, viewer)),
    });
  }

  private async rememberNames(ids: readonly string[]): Promise<void> {
    const missing = ids.filter((id) => !this.names.has(id));
    for (const [id, names] of await loadEntityNames(this.host.catalog, missing)) this.names.set(id, names);
  }

  // ---- bot (08 §10.5) ----

  private scheduleBotBurying(bot: LiveParticipant): void {
    if (!bot.bot) return;
    const { typingDelayMs } = bot.bot.profile;
    const delay = randomIntegerBetween(this.host.random, typingDelayMs.min, typingDelayMs.max);
    this.host.schedule(`bot-bury:${bot.id}`, new Date(this.host.now().getTime() + delay), async () => {
      const left = [...this.category];
      for (let index = 0; index < this.settings.burying.minesPerPlayer && left.length > 0; index += 1) {
        const [entityId] = left.splice(Math.floor(this.host.random.next() * left.length), 1);
        if (this.state?.phase !== 'BURYING') return;
        await this.handleCommand(bot.id, { type: 'MINE_BURY', answer: { entityId } });
      }
    });
  }

  private scheduleBotTurn(participantId: ParticipantId): void {
    const bot = this.host.participants().find((participant) => participant.id === participantId)?.bot;
    if (!bot) return;
    const delay = randomIntegerBetween(this.host.random, bot.profile.typingDelayMs.min, bot.profile.typingDelayMs.max);
    this.host.schedule(`bot-turn:${participantId}`, new Date(this.host.now().getTime() + delay), async () => {
      const state = this.state;
      if (state?.phase !== 'TURNS' || state.turnOf !== participantId) return;
      const knowChance = bot.profile.knowsAnswerByDifficulty[Math.min(Math.max(this.content.difficulty, 1), 5) - 1];
      // The bot never looks at the other player's mines: it can step on them like anyone (08 §10.2).
      const known = this.category.find(
        (id) => !state.used.includes(id) && !this.rules.isOwnLiveMine(state, participantId, id),
      );
      if (known && this.host.random.next() < knowChance) {
        await this.handleCommand(participantId, { type: 'MINE_ANSWER', answer: { entityId: known } });
        return;
      }
      if (this.host.random.next() >= bot.profile.guessChance) return;
      const decoys = await this.host.catalog.findDecoyEntityIds('PLAYER', this.category, BOT_DECOY_POOL_SIZE);
      const decoy = decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
      if (decoy) await this.handleCommand(participantId, { type: 'MINE_ANSWER', answer: { entityId: decoy } });
    });
  }
}
