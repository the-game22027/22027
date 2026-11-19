import type { RandomSource } from '../random-source';
import { SeededRandom } from '../random-source';
import {
  addPick,
  closeAttempt,
  findPickRejection,
  findThrowWinner,
  hasEveryonePicked,
  type RockPaperScissorsChoice,
  startRockPaperScissorsDuel,
} from './rock-paper-scissors-duel';

const pick = (participantId: string, choice: RockPaperScissorsChoice) => ({ participantId, choice, auto: false });

/** Returns the given numbers in order, for exact control over auto picks and draws. */
const fixedRandom = (...values: number[]): RandomSource => ({ next: () => values.shift() ?? 0 });

describe('rock-paper-scissors duel', () => {
  it.each([
    ['ROCK', 'SCISSORS', 'a'],
    ['SCISSORS', 'PAPER', 'a'],
    ['PAPER', 'ROCK', 'a'],
    ['ROCK', 'PAPER', 'b'],
    ['PAPER', 'PAPER', null],
  ] as const)('%s against %s is won by %s', (first, second, winner) => {
    expect(findThrowWinner(pick('a', first), pick('b', second))).toBe(winner);
  });

  it('takes one pick per player per attempt, and only for the current attempt', () => {
    let duel = startRockPaperScissorsDuel(['a', 'b'], 2);
    expect(findPickRejection(duel, 'a', 2)).toBe('ATTEMPT_NOT_CURRENT');
    expect(findPickRejection(duel, 'x', 1)).toBe('NOT_PARTICIPANT');
    duel = addPick(duel, 'a', 'ROCK');
    expect(findPickRejection(duel, 'a', 1)).toBe('ALREADY_PICKED');
    expect(hasEveryonePicked(duel)).toBe(false);
    duel = addPick(duel, 'b', 'PAPER');
    expect(hasEveryonePicked(duel)).toBe(true);
  });

  it('decides on the first throw that is not a tie', () => {
    const duel = addPick(addPick(startRockPaperScissorsDuel(['a', 'b'], 2), 'a', 'ROCK'), 'b', 'PAPER');
    const { closed, decision } = closeAttempt(duel, new SeededRandom(1));
    expect(closed).toEqual({ attempt: 1, picks: [pick('a', 'ROCK'), pick('b', 'PAPER')], winnerId: 'b' });
    expect(decision).toEqual({ winnerId: 'b', decidedBy: 'RPS' });
  });

  it('replays a tie while replays are left, with fresh picks', () => {
    const duel = addPick(addPick(startRockPaperScissorsDuel(['a', 'b'], 1), 'a', 'ROCK'), 'b', 'ROCK');
    const result = closeAttempt(duel, new SeededRandom(1));
    expect(result.decision).toBeNull();
    expect(result.duel.attempt).toBe(2);
    expect(result.duel.picks).toEqual([]);
    expect(findPickRejection(result.duel, 'a', 2)).toBeNull();
  });

  it('draws the winner with the random source after the last replay is a tie', () => {
    let duel = startRockPaperScissorsDuel(['a', 'b'], 1);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      duel = addPick(addPick(duel, 'a', 'PAPER'), 'b', 'PAPER');
      const result = closeAttempt(duel, fixedRandom(0.9));
      duel = result.duel;
      if (attempt === 1) expect(result.decision).toBeNull();
      else expect(result.decision).toEqual({ winnerId: 'b', decidedBy: 'DRAW' });
    }
    expect(duel.closedAttempts.map((closed) => closed.winnerId)).toEqual([null, null]);
  });

  it('picks for a player who did not pick in time, and marks the pick auto', () => {
    const duel = addPick(startRockPaperScissorsDuel(['a', 'b'], 0), 'a', 'ROCK');
    // 0.5 → PAPER for b, which beats ROCK.
    const { closed, decision } = closeAttempt(duel, fixedRandom(0.5));
    expect(closed.picks).toEqual([pick('a', 'ROCK'), { participantId: 'b', choice: 'PAPER', auto: true }]);
    expect(decision).toEqual({ winnerId: 'b', decidedBy: 'RPS' });
  });

  it('plays the same way again with the same seed', () => {
    const play = () => closeAttempt(startRockPaperScissorsDuel(['a', 'b'], 0), new SeededRandom(42));
    expect(play()).toEqual(play());
  });
});
