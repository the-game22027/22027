import { clampLimit, decodeCursor, encodeCursor, MAX_PAGE_LIMIT } from './pagination';

describe('pagination helpers', () => {
  it('clamps limits to 1..MAX with a default', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(5.7)).toBe(5);
    expect(clampLimit(10_000)).toBe(MAX_PAGE_LIMIT);
  });

  it('round-trips cursors and rejects garbage', () => {
    const cursor = encodeCursor({ points: 42, userId: 'u1' });
    expect(decodeCursor(cursor)).toEqual({ points: 42, userId: 'u1' });
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('[1,2]').toString('base64url'))).toBeNull();
  });
});
