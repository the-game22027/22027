import { exactScoreFrom, outcomeOf, sameScore } from './exact-score';
import { InvalidPicksError } from './prediction-errors';

const exact = (home?: number, away?: number) => [{ type: 'EXACT_SCORE', home, away }];

describe('exactScoreFrom', () => {
  it('accepts one exact score', () => {
    expect(exactScoreFrom(exact(2, 1), 20)).toEqual({ home: 2, away: 1 });
  });

  it('accepts a goalless draw', () => {
    expect(exactScoreFrom(exact(0, 0), 20)).toEqual({ home: 0, away: 0 });
  });

  it.each([
    ['nothing', []],
    ['a result pick', [{ type: 'RESULT' }]],
    ['a MOTM pick', [{ type: 'MOTM' }]],
    ['two picks', [...exact(1, 0), ...exact(2, 0)]],
  ])('refuses %s', (_name, picks) => {
    expect(() => exactScoreFrom(picks, 20)).toThrow(InvalidPicksError);
  });

  it.each([
    ['a negative score', -1, 0],
    ['a fraction', 1.5, 0],
    ['a missing score', undefined, 0],
    ['too many goals', 21, 0],
  ])('refuses %s', (_name, home, away) => {
    expect(() => exactScoreFrom(exact(home, away), 20)).toThrow(InvalidPicksError);
  });

  it('takes the limit from configuration', () => {
    expect(exactScoreFrom(exact(9, 0), 9)).toEqual({ home: 9, away: 0 });
    expect(() => exactScoreFrom(exact(9, 0), 8)).toThrow(InvalidPicksError);
  });
});

describe('outcomeOf', () => {
  it.each([
    [2, 1, 'HOME'],
    [1, 2, 'AWAY'],
    [1, 1, 'DRAW'],
  ])('%i-%i is %s', (home, away, expected) => {
    expect(outcomeOf({ home, away })).toBe(expected);
  });
});

describe('sameScore', () => {
  it('compares both sides', () => {
    expect(sameScore({ home: 1, away: 0 }, { home: 1, away: 0 })).toBe(true);
    expect(sameScore({ home: 1, away: 0 }, { home: 1, away: 1 })).toBe(false);
  });
});
