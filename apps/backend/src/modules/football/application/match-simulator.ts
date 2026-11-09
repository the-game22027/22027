import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/kernel';
import { MatchNotFoundError, SimulationRejectedError } from '../domain/football-errors';
import type { IncomingMatch } from '../domain/match-lifecycle';
import type { MatchStatus } from '../domain/match-status';
import type { Score } from '../domain/matchday-timeline';
import { type ApplyOutcome, ApplyProviderMatchUpdate } from './apply-provider-match-update';
import { FOOTBALL_DATA_PROVIDER, type FootballDataProvider } from './ports/football-data-provider';
import {
  MATCH_WRITE_REPOSITORY,
  type MatchWriteRepository,
  type ScheduledFixture,
  type SourcedMatch,
} from './ports/match-write-repository';

type Change = Partial<IncomingMatch> & Pick<IncomingMatch, 'status'>;

const MATCHDAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const REASON = 'simulator';

@Injectable()
export class MatchSimulator {
  constructor(
    @Inject(FOOTBALL_DATA_PROVIDER) private readonly provider: FootballDataProvider,
    @Inject(MATCH_WRITE_REPOSITORY) private readonly matches: MatchWriteRepository,
    private readonly updates: ApplyProviderMatchUpdate,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  nextMatchday(): Promise<ScheduledFixture[]> {
    return this.matches.nextScheduled(this.provider.name, MATCHDAY_WINDOW_MS);
  }

  kickoff(matchId: string): Promise<ApplyOutcome> {
    return this.change(matchId, (_, now) => ({ status: 'LIVE', startedAt: now, homeScore: 0, awayScore: 0 }));
  }

  score(matchId: string, score: Score): Promise<ApplyOutcome> {
    return this.change(matchId, () => ({ status: 'LIVE', homeScore: score.home, awayScore: score.away }), 'LIVE');
  }

  finish(matchId: string, score?: Score): Promise<ApplyOutcome> {
    return this.change(matchId, (match, now) => ({
      status: 'FINISHED',
      startedAt: match.startedAt ?? now,
      endedAt: now,
      homeScore: score?.home ?? match.homeScore ?? 0,
      awayScore: score?.away ?? match.awayScore ?? 0,
      decidedBy: 'REGULAR_TIME',
    }));
  }

  postpone(matchId: string): Promise<ApplyOutcome> {
    return this.change(matchId, () => ({ status: 'POSTPONED', reason: REASON }));
  }

  reschedule(matchId: string, kickoffAt: Date): Promise<ApplyOutcome> {
    return this.change(matchId, () => ({ status: 'SCHEDULED', kickoffAt }));
  }

  cancel(matchId: string): Promise<ApplyOutcome> {
    return this.change(matchId, () => ({ status: 'CANCELLED', reason: REASON }));
  }

  abandon(matchId: string): Promise<ApplyOutcome> {
    return this.change(matchId, () => ({ status: 'ABANDONED', reason: REASON }));
  }

  correctResult(matchId: string, score: Score): Promise<ApplyOutcome> {
    return this.change(
      matchId,
      () => ({ status: 'FINISHED', homeScore: score.home, awayScore: score.away }),
      'FINISHED',
    );
  }

  correctEndTime(matchId: string, endedAt: Date): Promise<ApplyOutcome> {
    return this.change(matchId, () => ({ status: 'FINISHED', endedAt }), 'FINISHED');
  }

  private async change(
    matchId: string,
    build: (match: SourcedMatch, now: Date) => Change,
    requiredStatus?: MatchStatus,
  ): Promise<ApplyOutcome> {
    const match = await this.matches.findById(matchId);
    if (!match || match.provider !== this.provider.name) throw new MatchNotFoundError();
    if (requiredStatus && match.status !== requiredStatus) {
      throw new SimulationRejectedError(`Match is ${match.status}, but this needs it to be ${requiredStatus}.`);
    }

    const now = this.clock.now();
    const change = build(match, now);
    const outcome = await this.updates.apply({ ...match, ...change, updatedAt: this.newerThanStored(match, now) });
    if (outcome === 'REJECTED') {
      throw new SimulationRejectedError(`Match is ${match.status}, so it cannot become ${change.status}.`);
    }
    return outcome;
  }

  // The stale check ignores anything not newer, and two steps can land in the same millisecond.
  private newerThanStored(match: SourcedMatch, now: Date): Date {
    const stored = match.providerUpdatedAt?.getTime() ?? 0;
    return new Date(Math.max(now.getTime(), stored + 1));
  }
}
