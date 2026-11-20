import type { CommonNeighbours, EngineContent } from '@modules/question-bank';
import {
  type BridgeAnswerResult,
  type BridgeCommand,
  type BridgeEvent,
  type BridgeRoundState,
  BridgeRules,
  listBoardLines,
  pickLineForBot,
} from '../../domain/games/bridge-rules';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { BridgeGameSettings } from '../battle-settings';
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

// Right answers the reveal shows per line, the best known first (08 §16.3).
const REVEAL_EXAMPLES = 3;
// Wrong names a bot may pick from: the most popular players (08 §16.5).
const BOT_DECOY_POOL_SIZE = 30;
// A line with this many scorers is easier for a bot: its chance to know one goes up by the bonus (08 §16.5).
const BOT_MANY_ANSWERS = 20;
const BOT_MANY_ANSWERS_BONUS = 0.15;

/** A الكوبري board (08 §16): the rules decide, this shell reads the link graph, names entities and plays the bot. */
export class BridgeRoundRunner implements RoundRunner {
  private readonly rules: BridgeRules;
  private state: BridgeRoundState | null = null;
  private readonly names: EntityNames = new Map();
  /** The scorers both clubs of the picked line conceded to, loaded when the line is picked. */
  private common: CommonNeighbours | null = null;
  /** The two evidence matches of each right line, for events, the snapshot and the reveal. */
  private readonly evidence = new Map<number, [{ en?: string; ar?: string }, { en?: string; ar?: string }]>();
  /** The best-known scorers of every picked line, for the reveal. */
  private readonly examples = new Map<number, string[]>();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: BridgeGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new BridgeRules({
      pickMs: settings.pickMs,
      answerMs: settings.answerMs,
      wrongLine: settings.wrongLine,
      latencyGraceMs,
      showWrongAnswers: settings.showWrongAnswers,
      points: settings.points,
    });
  }

  private get board(): { size: number; clubEntityIds: string[] } {
    if (this.content.body.gameType !== 'BRIDGE') throw new Error('A bridge runner needs bridge content');
    return this.content.body;
  }

  async start(): Promise<void> {
    const { size, clubEntityIds } = this.board;
    const players = this.host.activeParticipantIds();
    // The rock-paper-scissors winner picks first (08 §16.1 step 2).
    const firstPicker = this.host.firstMoverId ?? players[Math.floor(this.host.random.next() * players.length)];
    await this.ensureNames(clubEntityIds);
    await this.host.emit('round:start', (viewer) => ({
      roundNo: this.roundNo,
      gameType: this.host.gameType,
      size,
      clubs: clubEntityIds.map((id) => entityRef(this.names, id, viewer)),
      lines: listBoardLines(size).map((line, index) => ({ line: index, from: line.from, to: line.to })),
      firstPickerId: firstPicker,
      goalsSince: this.settings.goalsSince,
    }));
    const step = this.rules.startRound(this.roundNo, players, size, clubEntityIds, firstPicker, this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<RoundCommandOutcome> {
    if (!this.state) return 'INVALID_STATE';
    const now = this.host.now();
    if (command.type === 'BRIDGE_PICK') {
      const result = this.rules.handleCommand(this.state, from, { type: 'BRIDGE_PICK', line: command.line }, now);
      if (isRejection(result)) return result.code;
      await this.loadCommonScorers(result.state);
      this.state = result.state;
      await this.applyEffects(result.effects);
      return null;
    }
    if (command.type !== 'BRIDGE_ANSWER') return 'WRONG_GAME_TYPE';
    const early = this.rules.findAnswerRejection(this.state, from, now);
    if (early) return early.code;
    const judged = await this.judge(command.answer, this.state);
    if (typeof judged === 'string') return judged;
    const result = this.rules.handleCommand(this.state, from, judged, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    const drawn = result.effects.find((effect) => effect.type === 'EMIT' && effect.event.type === 'DRAWN');
    const answerResult: BridgeAnswerResult | 'TIME_UP' =
      drawn?.type === 'EMIT' && drawn.event.type === 'DRAWN' ? drawn.event.result : 'WRONG';
    return { accepted: true, data: { result: answerResult } };
  }

  async participantLeft(who: ParticipantId): Promise<void> {
    if (!this.state) return;
    const step = this.rules.participantLeft(this.state, who);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  snapshotFor(viewer: LiveParticipant): Record<string, unknown> {
    const state = this.state;
    const { size, clubEntityIds } = this.board;
    return {
      roundNo: this.roundNo,
      size,
      clubs: clubEntityIds.map((id) => entityRef(this.names, id, viewer)),
      goalsSince: this.settings.goalsSince,
      ...(state
        ? {
            lines: this.linesFor(viewer, state),
            squares: state.squares,
            turnId: state.turn,
            phase: state.phase,
            line: state.line,
            deadline: state.phase === 'CLOSED' ? null : state.deadline.toISOString(),
            points: state.points,
          }
        : {}),
    };
  }

  /** The server's match for a typed name among the line's scorers; bots send the entity id itself. */
  private async judge(answer: { text: string } | BotAnswer, state: BridgeRoundState): Promise<BridgeCommand | string> {
    const common = this.common;
    if (!common || state.line === null) return 'INVALID_STATE';
    let entityId: string | null;
    let scoredAgainstBoth: boolean;
    let typed: { text: string; match?: 'EXACT' | 'TYPO' | 'OTHER_ENTITY' | 'NONE' } | null = null;
    if ('entityId' in answer) {
      entityId = answer.entityId;
      scoredAgainstBoth = common.answers.some((candidate) => candidate.entityId === entityId);
    } else {
      // Scorers used on this board lose ties to unused ones, so a typo picks the name that can still be said.
      const judgement = await this.host.checker.judgeTypedTextAgainstLinks(
        common,
        answer.text,
        this.host.answerRules,
        state.used,
      );
      if (judgement.verdict === 'EMPTY') return 'EMPTY_ANSWER';
      entityId = judgement.entityId;
      scoredAgainstBoth = judgement.verdict === 'CORRECT';
      typed = { text: answer.text, match: judgement.match };
    }
    if (scoredAgainstBoth && entityId !== null && !state.used.includes(entityId)) {
      const evidence = common.answers.find((candidate) => candidate.entityId === entityId)?.evidence;
      if (evidence) this.evidence.set(state.line, evidence);
    }
    if (entityId) await this.ensureNames([entityId]);
    return { type: 'BRIDGE_ANSWER', answer: { entityId, ...(typed ?? {}) }, scoredAgainstBoth };
  }

  /** When a line is picked (by the player or at the deadline), its scorers are read once, before the clock runs. */
  private async loadCommonScorers(state: BridgeRoundState): Promise<void> {
    if (state.phase !== 'ANSWERING' || state.line === null) return;
    const { from, to } = state.lines[state.line];
    this.common = await this.host.linkGraph.findCommonNeighbours(state.clubs[from], state.clubs[to], 'CONCEDED_TO');
    this.examples.set(
      state.line,
      this.common.answers.slice(0, REVEAL_EXAMPLES + 1).map((candidate) => candidate.entityId),
    );
  }

  private async applyEffects(effects: Effect<BridgeEvent>[]): Promise<void> {
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
          await this.ensureNames([...this.examples.values()].flat());
          await this.host.endRound(effect.result, (viewer) => this.buildReveal(viewer));
          return;
      }
    }
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer, this.host.now(), this.host.random);
    await this.loadCommonScorers(step.state);
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private async emitEvent(event: BridgeEvent): Promise<void> {
    switch (event.type) {
      case 'TURN':
        await this.host.emit('bridge:turn', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          pickDeadlineAt: event.pickDeadlineAt.toISOString(),
        }));
        this.scheduleBotPick(event.participantId);
        return;
      case 'QUESTION':
        await this.host.emit('bridge:question', (viewer) => ({
          roundNo: event.roundNo,
          line: event.line,
          clubs: event.clubs.map((id) => entityRef(this.names, id, viewer)),
          auto: event.auto,
          answerDeadlineAt: event.answerDeadlineAt.toISOString(),
        }));
        this.scheduleBotAnswer();
        return;
      case 'DRAWN':
        return this.host.emit('bridge:drawn', (viewer) => ({
          roundNo: event.roundNo,
          line: event.line,
          participantId: event.participantId,
          right: event.result === 'RIGHT',
          result: event.result,
          ...(event.scorerEntityId
            ? {
                scorer: entityRef(this.names, event.scorerEntityId, viewer),
                evidence: this.evidenceFor(event.line, viewer),
              }
            : {}),
          ...(event.entityId ? { entity: entityRef(this.names, event.entityId, viewer) } : {}),
          squares: event.closed,
          scores: event.points,
        }));
    }
  }

  private evidenceFor(line: number, viewer: LiveParticipant): [string, string] {
    const [first, second] = this.evidence.get(line) ?? [{}, {}];
    return [first[viewer.locale] ?? first.en ?? '', second[viewer.locale] ?? second.en ?? ''];
  }

  private linesFor(viewer: LiveParticipant, state: BridgeRoundState): Record<string, unknown>[] {
    return state.lines.map((line, index) => {
      const drawn = state.drawn[index];
      return {
        line: index,
        from: line.from,
        to: line.to,
        drawnBy: drawn?.drawnBy ?? null,
        right: drawn?.right ?? null,
        ...(drawn?.scorerEntityId
          ? { scorer: entityRef(this.names, drawn.scorerEntityId, viewer), evidence: this.evidenceFor(index, viewer) }
          : {}),
      };
    });
  }

  /** Every line with who drew it and up to 3 scorers nobody named on it; open lines (after a forfeit) have none. */
  private buildReveal(viewer: LiveParticipant): Record<string, unknown> {
    const state = this.state;
    if (!state) return {};
    return {
      lines: state.lines.map((_, index) => {
        const drawn = state.drawn[index];
        const examples = (this.examples.get(index) ?? [])
          .filter((id) => id !== drawn?.scorerEntityId)
          .slice(0, REVEAL_EXAMPLES);
        return {
          line: index,
          drawnBy: drawn?.drawnBy ?? null,
          right: drawn?.right ?? null,
          ...(drawn?.scorerEntityId ? { scorer: entityRef(this.names, drawn.scorerEntityId, viewer) } : {}),
          examples: examples.map((id) => entityRef(this.names, id, viewer)),
        };
      }),
      squares: state.squares,
    };
  }

  private async ensureNames(ids: readonly string[]): Promise<void> {
    const missing = ids.filter((id) => !this.names.has(id));
    for (const [id, names] of await loadEntityNames(this.host.catalog, missing)) this.names.set(id, names);
  }

  // ---- bot (08 §16.5) ----

  private botOf(participantId: ParticipantId) {
    return this.host.participants().find((participant) => participant.id === participantId)?.bot;
  }

  private botDelay(participantId: ParticipantId): Date | null {
    const bot = this.botOf(participantId);
    if (!bot) return null;
    const { min, max } = bot.profile.typingDelayMs;
    return new Date(this.host.now().getTime() + randomIntegerBetween(this.host.random, min, max));
  }

  /** The bot closes a square when it can, and otherwise avoids handing one over (`pickLineForBot`). */
  private scheduleBotPick(participantId: ParticipantId): void {
    const at = this.botDelay(participantId);
    if (!at) return;
    this.host.schedule(`bot-pick:${participantId}`, at, async () => {
      const state = this.state;
      if (!state || state.phase !== 'PICKING' || state.turn !== participantId) return;
      const line = pickLineForBot(state, this.host.random);
      if (line !== null) await this.handleCommand(participantId, { type: 'BRIDGE_PICK', line });
    });
  }

  /** The bot names the best-known unused scorer when it knows one; otherwise a wrong popular player, or nothing. */
  private scheduleBotAnswer(): void {
    const participantId = this.state?.turn;
    if (participantId === undefined) return;
    const at = this.botDelay(participantId);
    const bot = this.botOf(participantId);
    if (!at || !bot) return;
    this.host.schedule(`bot-answer:${participantId}`, at, async () => {
      const state = this.state;
      const common = this.common;
      if (!state || !common || state.phase !== 'ANSWERING' || state.turn !== participantId) return;
      const difficulty = Math.min(Math.max(this.content.difficulty, 1), 5);
      const bonus = common.answers.length >= BOT_MANY_ANSWERS ? BOT_MANY_ANSWERS_BONUS : 0;
      const chance = Math.min(1, bot.profile.knowsAnswerByDifficulty[difficulty - 1] + bonus);
      const known = common.answers.find((candidate) => !state.used.includes(candidate.entityId));
      if (known && this.host.random.next() < chance) {
        await this.handleCommand(participantId, { type: 'BRIDGE_ANSWER', answer: { entityId: known.entityId } });
        return;
      }
      if (this.host.random.next() >= bot.profile.guessChance) return;
      const accepted = common.answers.map((candidate) => candidate.entityId);
      const decoys = await this.host.catalog.findDecoyEntityIds('PLAYER', accepted, BOT_DECOY_POOL_SIZE);
      const decoy = decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
      if (decoy) await this.handleCommand(participantId, { type: 'BRIDGE_ANSWER', answer: { entityId: decoy } });
    });
  }
}
