import { type CurrentMatch, type IncomingMatch, type MatchPlan, planMatchUpdate } from './match-lifecycle';
import { MATCH_STATUSES, type MatchStatus } from './match-status';

const kickoff = new Date('2026-11-09T20:00:00Z');
const end = new Date('2026-11-09T21:55:00Z');
const t1 = new Date('2026-11-09T10:00:00Z');
const t2 = new Date('2026-11-09T22:00:00Z');
const noResult = { homeScore: null, awayScore: null, decidedBy: null, homePenalties: null, awayPenalties: null };
const twoOne = { ...noResult, homeScore: 2, awayScore: 1, decidedBy: 'REGULAR_TIME' as const };

const current = (overrides: Partial<CurrentMatch> = {}): CurrentMatch => ({
  status: 'SCHEDULED',
  kickoffAt: kickoff,
  startedAt: null,
  endedAt: null,
  ...noResult,
  resultVersion: 0,
  providerUpdatedAt: t1,
  ...overrides,
});

const incoming = (overrides: Partial<IncomingMatch> = {}): IncomingMatch => ({
  status: 'SCHEDULED',
  kickoffAt: kickoff,
  startedAt: null,
  endedAt: null,
  ...noResult,
  updatedAt: t2,
  ...overrides,
});

const finished = (overrides: Partial<CurrentMatch> = {}) =>
  current({ status: 'FINISHED', startedAt: kickoff, endedAt: end, ...twoOne, resultVersion: 1, ...overrides });

function applied(plan: MatchPlan) {
  if (plan.kind !== 'APPLY') throw new Error(`expected APPLY, got ${plan.kind}`);
  return plan;
}

const eventTypes = (plan: MatchPlan) => applied(plan).events.map((event) => event.type);

describe('planMatchUpdate', () => {
  describe('ordering', () => {
    it('ignores an update older than the stored one', () => {
      expect(planMatchUpdate(current({ providerUpdatedAt: t2 }), incoming({ updatedAt: t1 })).kind).toBe('STALE');
    });

    it('ignores the same update delivered twice', () => {
      expect(planMatchUpdate(current({ providerUpdatedAt: t2 }), incoming({ updatedAt: t2 })).kind).toBe('STALE');
    });

    it('accepts any update when nothing is stored yet', () => {
      expect(planMatchUpdate(current({ providerUpdatedAt: null }), incoming()).kind).toBe('APPLY');
    });
  });

  describe('legal transitions', () => {
    const legal: Record<MatchStatus, MatchStatus[]> = {
      SCHEDULED: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'],
      POSTPONED: ['POSTPONED', 'SCHEDULED', 'CANCELLED'],
      LIVE: ['LIVE', 'FINISHED', 'ABANDONED'],
      FINISHED: ['FINISHED'],
      ABANDONED: ['ABANDONED', 'SCHEDULED'],
      CANCELLED: ['CANCELLED'],
    };
    const cases = MATCH_STATUSES.flatMap((from) => MATCH_STATUSES.map((to) => [from, to] as const));

    it.each(cases)('%s → %s', (from, to) => {
      const update = to === 'FINISHED' ? incoming({ status: to, endedAt: end, ...twoOne }) : incoming({ status: to });
      const plan = planMatchUpdate(current({ status: from }), update);
      expect(plan.kind).toBe(legal[from].includes(to) ? 'APPLY' : 'REJECTED');
    });
  });

  it('nothing changed: applies with no events', () => {
    const plan = applied(planMatchUpdate(current(), incoming()));
    expect(plan.changed).toBe(false);
    expect(plan.events).toEqual([]);
  });

  it('kickoff moved: announces the old and new time', () => {
    const moved = new Date('2026-11-10T20:00:00Z');
    const plan = applied(planMatchUpdate(current(), incoming({ kickoffAt: moved })));
    expect(plan.next.kickoffAt).toEqual(moved);
    expect(plan.events).toEqual([{ type: 'MatchKickoffChanged', previousKickoffAt: kickoff, kickoffAt: moved }]);
  });

  it('kickoff of a started match never moves', () => {
    const late = new Date('2026-11-09T20:15:00Z');
    const plan = applied(planMatchUpdate(current(), incoming({ status: 'LIVE', kickoffAt: late, startedAt: late })));
    expect(plan.next.kickoffAt).toEqual(kickoff);
    expect(plan.next.startedAt).toEqual(late);
  });

  it('start: uses the provider time, or the kickoff when it has none', () => {
    const plan = planMatchUpdate(current(), incoming({ status: 'LIVE' }));
    expect(applied(plan).events).toEqual([{ type: 'MatchStarted', startedAt: kickoff }]);
  });

  it('live score: updates without an event', () => {
    const live = current({ status: 'LIVE', startedAt: kickoff, homeScore: 0, awayScore: 0 });
    const plan = applied(planMatchUpdate(live, incoming({ status: 'LIVE', homeScore: 1, awayScore: 0 })));
    expect(plan.next.homeScore).toBe(1);
    expect(plan.changed).toBe(true);
    expect(plan.events).toEqual([]);
  });

  it('finish: raises the result version and announces the result', () => {
    const live = current({ status: 'LIVE', startedAt: kickoff });
    const plan = applied(planMatchUpdate(live, incoming({ status: 'FINISHED', endedAt: end, ...twoOne })));
    expect(plan.next.resultVersion).toBe(1);
    expect(plan.events).toEqual([{ type: 'MatchFinished', endedAt: end, result: twoOne }]);
  });

  it('finish straight from scheduled: also announces the start', () => {
    const plan = planMatchUpdate(current(), incoming({ status: 'FINISHED', endedAt: end, ...twoOne }));
    expect(eventTypes(plan)).toEqual(['MatchStarted', 'MatchFinished']);
  });

  it.each([
    { endedAt: null, ...twoOne },
    { endedAt: end, ...noResult },
  ])('finish without its end time or score is rejected: %j', (facts) => {
    const live = current({ status: 'LIVE', startedAt: kickoff });
    expect(planMatchUpdate(live, incoming({ status: 'FINISHED', ...facts })).kind).toBe('REJECTED');
  });

  describe('after the final whistle', () => {
    it('same result: nothing to announce', () => {
      const plan = applied(planMatchUpdate(finished(), incoming({ status: 'FINISHED', endedAt: end, ...twoOne })));
      expect(plan.changed).toBe(false);
      expect(plan.next.resultVersion).toBe(1);
      expect(plan.events).toEqual([]);
    });

    it('corrected score: raises the result version', () => {
      const result = { ...twoOne, awayScore: 2 };
      const plan = applied(planMatchUpdate(finished(), incoming({ status: 'FINISHED', endedAt: end, ...result })));
      expect(plan.next.resultVersion).toBe(2);
      expect(plan.events).toEqual([{ type: 'MatchResultCorrected', result, correctedAt: t2 }]);
    });

    it('corrected end time: keeps the result version', () => {
      const later = new Date('2026-11-09T22:05:00Z');
      const plan = applied(planMatchUpdate(finished(), incoming({ status: 'FINISHED', endedAt: later, ...twoOne })));
      expect(plan.next.resultVersion).toBe(1);
      expect(plan.events).toEqual([{ type: 'MatchEndTimeCorrected', endedAt: later }]);
    });
  });

  it.each([
    ['POSTPONED', 'SCHEDULED', 'MatchPostponed'],
    ['CANCELLED', 'SCHEDULED', 'MatchCancelled'],
    ['ABANDONED', 'LIVE', 'MatchAbandoned'],
  ] as const)('%s from %s: announces once, with the reason', (status, from, type) => {
    const plan = applied(planMatchUpdate(current({ status: from }), incoming({ status, reason: 'storm' })));
    expect(plan.events).toEqual([{ type, reason: 'storm' }]);
  });

  it.each(['POSTPONED', 'ABANDONED'] as const)('reopening from %s: clears play data and reopens', (status) => {
    const before = current({ status, startedAt: kickoff, homeScore: 1, awayScore: 0 });
    const moved = new Date('2026-12-01T20:00:00Z');
    const plan = applied(planMatchUpdate(before, incoming({ kickoffAt: moved })));
    expect(plan.next).toMatchObject({ status: 'SCHEDULED', kickoffAt: moved, startedAt: null, homeScore: null });
    expect(plan.events).toEqual([{ type: 'MatchKickoffChanged', previousKickoffAt: kickoff, kickoffAt: moved }]);
  });
});
