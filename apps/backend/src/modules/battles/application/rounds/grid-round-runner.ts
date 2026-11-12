import type { EngineContent } from '@modules/question-bank';
import { chooseGridCell } from '../../domain/bots/grid-bot';
import { type Effect, isRejection, type ParticipantId } from '../../domain/games/game-rules';
import { type GridEvent, GridRules, type GridRoundState } from '../../domain/games/grid-rules';
import { randomIntegerBetween } from '../../domain/random-source';
import type { GridGameSettings } from '../battle-settings';
import type { LiveParticipant } from '../live-participant';
import {
  type EntityNames,
  entityRef,
  loadEntityNames,
  type PlayerCommand,
  type RoundHost,
  type RoundRunner,
} from './round-runner';

// How many wrong players a bot picks from when it answers wrong.
const BOT_DECOY_POOL_SIZE = 30;

const cellOf = (cell: number) => ({ row: Math.floor(cell / 3), col: cell % 3 });

/** A football tic-tac-toe round (08 §3.2). */
export class GridRoundRunner implements RoundRunner {
  private readonly rules: GridRules;
  private state: GridRoundState | null = null;
  private names: EntityNames = new Map();
  private readonly validPlayersByCell = new Map<number, string[]>();

  constructor(
    readonly roundNo: number,
    private readonly content: EngineContent,
    private readonly settings: GridGameSettings,
    latencyGraceMs: number,
    private readonly host: RoundHost,
  ) {
    this.rules = new GridRules({ ...settings, latencyGraceMs });
    for (const { slot, entityIds } of content.acceptedAnswers) this.validPlayersByCell.set(slot, entityIds);
  }

  private get body() {
    if (this.content.body.gameType !== 'GRID') throw new Error('A grid runner needs grid content');
    return this.content.body;
  }

  async start(): Promise<void> {
    const criteria = [...this.body.rows, ...this.body.cols].map((criterion) => criterion.entityId);
    this.names = await loadEntityNames(this.host.catalog, criteria);
    const players = this.host.activeParticipantIds();
    // Who starts comes from the battle's seeded random source, so a replay starts the same way.
    const firstTurn = players[Math.floor(this.host.random.next() * players.length)];
    const step = this.rules.startRound(this.roundNo, players, firstTurn, this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  async handleCommand(from: ParticipantId, command: PlayerCommand): Promise<string | null> {
    if (command.type === 'GRID_SKIP') return this.applyCommand(from, { type: 'GRID_SKIP' });
    if (command.type !== 'GRID_CLAIM') return 'WRONG_GAME_TYPE';
    if (!this.state) return 'INVALID_STATE';
    const rejection = this.rules.findClaimRejection(this.state, from, command.cell, command.entityId, this.host.now());
    if (rejection) return rejection.code;
    const verdict = await this.host.checker.checkTypedAnswer(this.content.contentId, command.cell, command.entityId);
    if (verdict === 'UNKNOWN_ENTITY') return 'UNKNOWN_ENTITY';
    return this.applyCommand(from, { type: 'GRID_CLAIM', cell: command.cell, entityId: command.entityId, verdict });
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
      ...this.boardCriteriaFor(viewer),
      ...(state
        ? {
            phase: state.phase,
            board: state.board.map((owner, cell) => ({ cell: cellOf(cell), owner })),
            turnOf: state.turnOf,
            attemptsLeft: state.attemptsLeft,
            deadlines: { turnDeadlineAt: state.turnDeadlineAt.toISOString() },
          }
        : {}),
    };
  }

  private async applyCommand(
    from: ParticipantId,
    command: Parameters<GridRules['handleCommand']>[2],
  ): Promise<string | null> {
    if (!this.state) return 'INVALID_STATE';
    const result = this.rules.handleCommand(this.state, from, command, this.host.now());
    if (isRejection(result)) return result.code;
    this.state = result.state;
    await this.applyEffects(result.effects);
    return null;
  }

  private async applyEffects(effects: Effect<GridEvent>[]): Promise<void> {
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
          const reveal = await this.buildReveal();
          await this.host.endRound(effect.result, reveal);
          return;
        }
      }
    }
  }

  private async onRulesTimer(timer: string): Promise<void> {
    if (!this.state) return;
    const step = this.rules.handleTimer(this.state, timer, this.host.now());
    this.state = step.state;
    await this.applyEffects(step.effects);
  }

  private boardCriteriaFor(viewer: LiveParticipant) {
    const criterion = (item: { kind: string; entityId: string }) => ({
      kind: item.kind,
      entity: entityRef(this.names, item.entityId, viewer),
    });
    return { rows: this.body.rows.map(criterion), cols: this.body.cols.map(criterion) };
  }

  private async emitEvent(event: GridEvent): Promise<void> {
    switch (event.type) {
      case 'ROUND_STARTED':
        return this.host.emit('round:start', (viewer) => ({
          roundNo: event.roundNo,
          gameType: this.host.gameType,
          ...this.boardCriteriaFor(viewer),
          firstTurnParticipantId: event.firstTurn,
        }));
      case 'TURN':
        this.scheduleBotTurn(event.participantId);
        return this.host.emit('grid:turn', () => ({
          roundNo: event.roundNo,
          participantId: event.participantId,
          turnDeadlineAt: event.turnDeadlineAt.toISOString(),
          attemptsLeft: event.attemptsLeft,
        }));
      case 'CLAIMED': {
        const names = await loadEntityNames(this.host.catalog, [event.entityId]);
        return this.host.emit('grid:claimed', (viewer) => ({
          roundNo: event.roundNo,
          cell: cellOf(event.cell),
          participantId: event.participantId,
          player: entityRef(names, event.entityId, viewer),
        }));
      }
      case 'MISSED': {
        const entityId = event.entityId;
        const names = entityId ? await loadEntityNames(this.host.catalog, [entityId]) : (new Map() as EntityNames);
        return this.host.emit('grid:missed', (viewer) => ({
          roundNo: event.roundNo,
          cell: event.cell === null ? null : cellOf(event.cell),
          participantId: event.participantId,
          ...(entityId ? { answer: entityRef(names, entityId, viewer) } : {}),
          timedOut: event.timedOut,
          skipped: event.skipped,
        }));
      }
    }
  }

  /** The winning line, and one valid unused player per empty cell when `revealAnswersAtEnd` is on (08 §3.2). */
  private async buildReveal(): Promise<(viewer: LiveParticipant) => Record<string, unknown>> {
    const state = this.state;
    const used = new Set(state?.usedPlayers ?? []);
    const samples = this.settings.revealAnswersAtEnd
      ? (state?.board ?? []).flatMap((owner, cell) => {
          const player = (this.validPlayersByCell.get(cell) ?? []).find((id) => !used.has(id));
          return owner === null && player ? [{ cell, player }] : [];
        })
      : [];
    const names = await loadEntityNames(
      this.host.catalog,
      samples.map((sample) => sample.player),
    );
    return (viewer) => ({
      ...(state?.line ? { line: state.line.map(cellOf) } : {}),
      sampleAnswers: samples.map(({ cell, player }) => ({
        cell: cellOf(cell),
        player: entityRef(names, player, viewer),
      })),
    });
  }

  // ---- bot (08 §3.3) ----

  private scheduleBotTurn(participantId: ParticipantId): void {
    const bot = this.host.participants().find((participant) => participant.id === participantId)?.bot;
    if (!bot) return;
    const delay = randomIntegerBetween(this.host.random, bot.profile.typingDelayMs.min, bot.profile.typingDelayMs.max);
    this.host.schedule(`bot-turn:${participantId}`, new Date(this.host.now().getTime() + delay), async () => {
      const state = this.state;
      if (state?.phase !== 'TURN' || state.turnOf !== participantId) return;
      const used = new Set(state.usedPlayers);
      const playable = state.board.flatMap((owner, cell) =>
        owner === null && (this.validPlayersByCell.get(cell) ?? []).some((id) => !used.has(id)) ? [cell] : [],
      );
      const cell = chooseGridCell(state.board, participantId, playable, this.host.random);
      if (cell === null) {
        await this.applyCommand(participantId, { type: 'GRID_SKIP' });
        return;
      }
      const knowChance = bot.profile.knowsAnswerByDifficulty[Math.min(Math.max(this.content.difficulty, 1), 5) - 1];
      const valid = this.validPlayersByCell.get(cell) ?? [];
      const entityId =
        this.host.random.next() < knowChance
          ? valid.find((id) => !used.has(id))
          : await this.pickWrongPlayer([...valid, ...used]);
      if (!entityId) {
        await this.applyCommand(participantId, { type: 'GRID_SKIP' });
        return;
      }
      await this.handleCommand(participantId, { type: 'GRID_CLAIM', cell, entityId });
    });
  }

  private async pickWrongPlayer(excluded: string[]): Promise<string | undefined> {
    const decoys = await this.host.catalog.findDecoyEntityIds('PLAYER', excluded, BOT_DECOY_POOL_SIZE);
    return decoys[randomIntegerBetween(this.host.random, 0, Math.max(0, decoys.length - 1))];
  }
}
