import type { MatchStatus } from './match-status';

export type DecidedBy = 'REGULAR_TIME' | 'EXTRA_TIME' | 'PENALTIES';

export interface MatchResult {
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly decidedBy: DecidedBy | null;
  readonly homePenalties: number | null;
  readonly awayPenalties: number | null;
}

export interface MatchFacts extends MatchResult {
  readonly status: MatchStatus;
  readonly kickoffAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
}

export interface CurrentMatch extends MatchFacts {
  readonly resultVersion: number;
  readonly providerUpdatedAt: Date | null;
}

export interface IncomingMatch extends MatchFacts {
  readonly updatedAt: Date;
  readonly reason?: string;
}

export type MatchEvent =
  | { readonly type: 'MatchKickoffChanged'; readonly previousKickoffAt: Date; readonly kickoffAt: Date }
  | { readonly type: 'MatchStarted'; readonly startedAt: Date }
  | { readonly type: 'MatchFinished'; readonly endedAt: Date; readonly result: MatchResult }
  | { readonly type: 'MatchResultCorrected'; readonly result: MatchResult; readonly correctedAt: Date }
  | { readonly type: 'MatchEndTimeCorrected'; readonly endedAt: Date }
  | { readonly type: 'MatchPostponed' | 'MatchCancelled' | 'MatchAbandoned'; readonly reason: string | null };

export type MatchPlan =
  | { readonly kind: 'STALE' }
  | { readonly kind: 'REJECTED'; readonly reason: string }
  | {
      readonly kind: 'APPLY';
      readonly next: MatchFacts & { readonly resultVersion: number };
      readonly changed: boolean;
      readonly events: readonly MatchEvent[];
    };

const LEGAL_NEXT: Readonly<Record<MatchStatus, readonly MatchStatus[]>> = {
  SCHEDULED: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['POSTPONED', 'SCHEDULED', 'CANCELLED'],
  LIVE: ['LIVE', 'FINISHED', 'ABANDONED'],
  FINISHED: ['FINISHED'],
  ABANDONED: ['ABANDONED', 'SCHEDULED'],
  CANCELLED: ['CANCELLED'],
};

const NO_RESULT: MatchResult = {
  homeScore: null,
  awayScore: null,
  decidedBy: null,
  homePenalties: null,
  awayPenalties: null,
};

const resultOf = (match: MatchResult): MatchResult => ({
  homeScore: match.homeScore,
  awayScore: match.awayScore,
  decidedBy: match.decidedBy,
  homePenalties: match.homePenalties,
  awayPenalties: match.awayPenalties,
});

const sameResult = (a: MatchResult, b: MatchResult): boolean =>
  a.homeScore === b.homeScore &&
  a.awayScore === b.awayScore &&
  a.decidedBy === b.decidedBy &&
  a.homePenalties === b.homePenalties &&
  a.awayPenalties === b.awayPenalties;

const sameTime = (a: Date | null, b: Date | null): boolean => a?.getTime() === b?.getTime();

function plannedKickoff(current: CurrentMatch, incoming: IncomingMatch): Date {
  // Once a match has kicked off, kickoff_at stays the instant predictions locked.
  return incoming.status === 'SCHEDULED' || incoming.status === 'POSTPONED' ? incoming.kickoffAt : current.kickoffAt;
}

export function planMatchUpdate(current: CurrentMatch, incoming: IncomingMatch): MatchPlan {
  if (current.providerUpdatedAt && incoming.updatedAt.getTime() <= current.providerUpdatedAt.getTime()) {
    return { kind: 'STALE' };
  }
  if (!LEGAL_NEXT[current.status].includes(incoming.status)) {
    return { kind: 'REJECTED', reason: `${current.status} cannot become ${incoming.status}` };
  }
  if (
    incoming.status === 'FINISHED' &&
    (incoming.endedAt === null || incoming.homeScore === null || incoming.awayScore === null)
  ) {
    return { kind: 'REJECTED', reason: 'a finished match needs an end time and a score' };
  }

  const events: MatchEvent[] = [];
  const reason = incoming.reason ?? null;
  const kickoffAt = plannedKickoff(current, incoming);
  const reopened = incoming.status === 'SCHEDULED' && current.status !== 'SCHEDULED';
  if (incoming.status === 'SCHEDULED' && (reopened || !sameTime(kickoffAt, current.kickoffAt))) {
    events.push({ type: 'MatchKickoffChanged', previousKickoffAt: current.kickoffAt, kickoffAt });
  }

  // A provider polled too rarely can jump from SCHEDULED to FINISHED: treat it as having passed through LIVE.
  const startsNow = (incoming.status === 'LIVE' || incoming.status === 'FINISHED') && current.status === 'SCHEDULED';
  const startedAt = reopened ? null : startsNow ? (incoming.startedAt ?? kickoffAt) : current.startedAt;
  if (startsNow && startedAt) events.push({ type: 'MatchStarted', startedAt });

  let resultVersion = current.resultVersion;
  if (incoming.status === 'FINISHED' && incoming.endedAt) {
    const result = resultOf(incoming);
    if (current.status !== 'FINISHED') {
      resultVersion += 1;
      events.push({ type: 'MatchFinished', endedAt: incoming.endedAt, result });
    } else {
      if (!sameResult(result, current)) {
        resultVersion += 1;
        events.push({ type: 'MatchResultCorrected', result, correctedAt: incoming.updatedAt });
      }
      if (!sameTime(incoming.endedAt, current.endedAt)) {
        events.push({ type: 'MatchEndTimeCorrected', endedAt: incoming.endedAt });
      }
    }
  }

  if (current.status !== incoming.status) {
    if (incoming.status === 'POSTPONED') events.push({ type: 'MatchPostponed', reason });
    if (incoming.status === 'CANCELLED') events.push({ type: 'MatchCancelled', reason });
    if (incoming.status === 'ABANDONED') events.push({ type: 'MatchAbandoned', reason });
  }

  const hasLiveData = incoming.status === 'LIVE' || incoming.status === 'FINISHED' || incoming.status === 'ABANDONED';
  const result = reopened ? NO_RESULT : hasLiveData ? resultOf(incoming) : resultOf(current);
  const next = {
    status: incoming.status,
    kickoffAt,
    startedAt,
    endedAt: incoming.status === 'FINISHED' ? incoming.endedAt : reopened ? null : current.endedAt,
    ...result,
    resultVersion,
  };
  const changed =
    next.status !== current.status ||
    !sameTime(next.kickoffAt, current.kickoffAt) ||
    !sameTime(next.startedAt, current.startedAt) ||
    !sameTime(next.endedAt, current.endedAt) ||
    !sameResult(next, current);
  return { kind: 'APPLY', next, changed, events };
}
