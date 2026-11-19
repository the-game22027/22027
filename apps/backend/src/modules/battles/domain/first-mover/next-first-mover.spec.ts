import { chooseNextFirstMover } from './next-first-mover';

describe('next first mover', () => {
  it('ALTERNATE passes the first move to the next seat', () => {
    expect(chooseNextFirstMover('ALTERNATE', ['a', 'b'], ['a', 'b'], 'a', 'a')).toBe('b');
    expect(chooseNextFirstMover('ALTERNATE', ['a', 'b'], ['a', 'b'], 'b', null)).toBe('a');
    expect(chooseNextFirstMover('ALTERNATE', ['a', 'b', 'c'], ['a', 'b', 'c'], 'c', null)).toBe('a');
  });

  it('ALTERNATE skips players who left', () => {
    expect(chooseNextFirstMover('ALTERNATE', ['a', 'b', 'c'], ['a', 'c'], 'a', null)).toBe('c');
    expect(chooseNextFirstMover('ALTERNATE', ['a', 'b', 'c'], ['a', 'c'], 'b', null)).toBe('c');
  });

  it('LOSER_STARTS gives the first move to whoever lost the last round', () => {
    expect(chooseNextFirstMover('LOSER_STARTS', ['a', 'b'], ['a', 'b'], 'b', 'a')).toBe('b');
    expect(chooseNextFirstMover('LOSER_STARTS', ['a', 'b'], ['a', 'b'], 'a', 'b')).toBe('a');
  });

  it('LOSER_STARTS alternates after a draw, and with three or more players', () => {
    expect(chooseNextFirstMover('LOSER_STARTS', ['a', 'b'], ['a', 'b'], 'a', null)).toBe('b');
    expect(chooseNextFirstMover('LOSER_STARTS', ['a', 'b', 'c'], ['a', 'b', 'c'], 'a', 'b')).toBe('b');
  });
});
