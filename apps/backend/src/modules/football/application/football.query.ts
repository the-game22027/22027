import { Inject, Injectable } from '@nestjs/common';
import {
  clampLimit,
  CLOCK,
  type Clock,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  type Page,
  type PageRequest,
} from '@shared/kernel';
import { MatchNotFoundError } from '../domain/football-errors';
import { isPredictable } from '../domain/match-status';
import type {
  CompetitionRecord,
  MatchFilter,
  MatchLockInfo,
  MatchPosition,
  MatchRecord,
  MatchView,
  SquadPlayerRecord,
} from './football-records';
import { FOOTBALL_READ_REPOSITORY, type FootballReadRepository } from './ports/football-read-repository';

@Injectable()
export class FootballQuery {
  constructor(
    @Inject(FOOTBALL_READ_REPOSITORY) private readonly football: FootballReadRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  listCompetitions(): Promise<CompetitionRecord[]> {
    return this.football.listActiveCompetitions();
  }

  async listMatches(filter: MatchFilter, page: Partial<PageRequest>): Promise<Page<MatchView>> {
    const limit = clampLimit(page.limit);
    const after = page.cursor === undefined ? undefined : positionFrom(page.cursor);
    // One extra row tells us whether another page exists without a COUNT.
    const rows = await this.football.listMatches(filter, after, limit + 1);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map((match) => this.view(match)),
      nextCursor: rows.length > limit && last ? encodeCursor({ k: last.kickoffAt.toISOString(), i: last.id }) : null,
    };
  }

  /** For display and error messages only: the prediction write checks again with the database clock. */
  async getLockInfo(matchId: string): Promise<MatchLockInfo> {
    const match = await this.football.findLockFacts(matchId);
    if (!match) throw new MatchNotFoundError();
    return {
      status: match.status,
      kickoffAt: match.kickoffAt,
      predictable: isPredictable(match.status, match.kickoffAt, this.clock.now()),
    };
  }

  /**
   * The matches whose kickoff has passed by the database clock, the same clock that locks predictions, so a
   * prediction becomes visible to friends exactly when it can no longer change (DEC-21).
   */
  findMatchIdsPastKickoff(matchIds: readonly string[]): Promise<string[]> {
    return this.football.findMatchIdsPastKickoff(matchIds);
  }

  async getMatch(matchId: string): Promise<MatchView & { serverTime: Date }> {
    const match = await this.football.findMatch(matchId);
    if (!match) throw new MatchNotFoundError();
    return { ...this.view(match), serverTime: this.clock.now() };
  }

  async getSquads(matchId: string): Promise<SquadPlayerRecord[]> {
    if (!(await this.football.findMatch(matchId))) throw new MatchNotFoundError();
    return this.football.listSquad(matchId);
  }

  private view(match: MatchRecord): MatchView {
    return { ...match, predictable: isPredictable(match.status, match.kickoffAt, this.clock.now()) };
  }
}

function positionFrom(cursor: string): MatchPosition {
  const position = decodeCursor<{ k?: unknown; i?: unknown }>(cursor);
  const kickoffAt = typeof position?.k === 'string' ? new Date(position.k) : undefined;
  if (!kickoffAt || Number.isNaN(kickoffAt.getTime()) || typeof position?.i !== 'string' || !isUuid(position.i)) {
    throw new InvalidCursorError();
  }
  return { kickoffAt, id: position.i };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
