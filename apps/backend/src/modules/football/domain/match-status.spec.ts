import { isPredictable, MATCH_STATUSES } from './match-status';

describe('isPredictable', () => {
  const kickoff = new Date('2026-11-09T20:00:00Z');
  const before = new Date('2026-11-09T19:59:59Z');

  it('is open for a scheduled match before kickoff', () => {
    expect(isPredictable('SCHEDULED', kickoff, before)).toBe(true);
  });

  it('closes at the exact kickoff instant', () => {
    expect(isPredictable('SCHEDULED', kickoff, kickoff)).toBe(false);
  });

  it.each(MATCH_STATUSES.filter((status) => status !== 'SCHEDULED'))('is closed for %s', (status) => {
    expect(isPredictable(status, kickoff, before)).toBe(false);
  });
});
