import { type MatchdayFixture, type MatchdayStep, planMatchday } from './matchday-timeline';

const fixture = (matchId: string, time: string): MatchdayFixture => ({
  matchId,
  kickoffAt: new Date(`2026-11-14T${time}:00Z`),
});
const stepsOf = (steps: MatchdayStep[], matchId: string) => steps.filter((step) => step.matchId === matchId);
const finalScore = (steps: MatchdayStep[]) => {
  const last = steps.at(-1);
  if (last?.kind !== 'FINISH') throw new Error('The match never finished');
  return last.score;
};

describe('planMatchday', () => {
  it('plans nothing for an empty day', () => {
    expect(planMatchday([])).toEqual([]);
  });

  it('measures time from the first kickoff', () => {
    const steps = planMatchday([fixture('late', '17:00'), fixture('early', '15:00')]);
    expect(steps[0]).toEqual({ kind: 'KICKOFF', atMs: 0, matchId: 'early' });
    expect(stepsOf(steps, 'late')[0].atMs).toBe(2 * 60 * 60 * 1000);
  });

  it('keeps steps in time order across matches', () => {
    const steps = planMatchday([fixture('a', '15:00'), fixture('b', '15:30'), fixture('c', '16:00')]);
    const times = steps.map((step) => step.atMs);
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });

  it('starts each match, then finishes it with the score of its last goal', () => {
    const steps = stepsOf(planMatchday([fixture('m', '15:00')]), 'm');
    expect(steps[0].kind).toBe('KICKOFF');
    const goals = steps.filter((step) => step.kind === 'SCORE');
    const { home, away } = finalScore(steps);
    expect(goals).toHaveLength(home + away);
    if (goals.length > 0) expect(goals.at(-1)).toMatchObject({ score: { home, away } });
  });

  it('produces the same day every time', () => {
    const day = [fixture('a', '15:00'), fixture('b', '18:00')];
    expect(planMatchday(day)).toEqual(planMatchday(day));
  });

  it('does not give every match the same result', () => {
    const results = Array.from({ length: 40 }, (_, index) => {
      const matchId = `0193a3b2-0000-7000-8000-${String(index).padStart(12, '0')}`;
      return JSON.stringify(finalScore(planMatchday([fixture(matchId, '15:00')])));
    });
    expect(new Set(results).size).toBeGreaterThan(4);
  });
});
