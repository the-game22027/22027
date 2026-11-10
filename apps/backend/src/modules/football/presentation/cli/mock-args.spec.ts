import { parseInstant, parseMatchId, parseScore, parseSpeed } from './mock-args';

describe('simulator arguments', () => {
  it('accepts a uuid and refuses anything else', () => {
    const id = '0193a3b2-1c2d-7e3f-8a4b-5c6d7e8f9a0b';
    expect(parseMatchId(id)).toBe(id);
    expect(() => parseMatchId('42')).toThrow('not a match id');
  });

  it('reads a score as home-away', () => {
    expect(parseScore('2-1')).toEqual({ home: 2, away: 1 });
    expect(parseScore('10-0')).toEqual({ home: 10, away: 0 });
  });

  it.each(['2', '2:1', '-1-2', 'a-b', '100-1'])('refuses the score %s', (value) => {
    expect(() => parseScore(value)).toThrow('not a score');
  });

  it('reads a UTC instant', () => {
    expect(parseInstant('2026-11-14T20:00:00Z')).toEqual(new Date(Date.UTC(2026, 10, 14, 20)));
  });

  it.each(['tomorrow', '2026-11-14T20:00:00', '2026-13-14T20:00:00Z'])('refuses the time %s', (value) => {
    expect(() => parseInstant(value)).toThrow('not a UTC time');
  });

  it.each([
    ['60x', 60],
    ['60', 60],
    ['0.5x', 0.5],
  ])('reads the speed %s', (value, expected) => {
    expect(parseSpeed(value)).toBe(expected);
  });

  it.each(['0x', '-2x', 'fast'])('refuses the speed %s', (value) => {
    expect(() => parseSpeed(value)).toThrow('not a speed');
  });
});
