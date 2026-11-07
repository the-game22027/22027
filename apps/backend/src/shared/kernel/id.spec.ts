import { isUuidV7, UuidV7Generator } from './id';

describe('UuidV7Generator', () => {
  it('produces RFC 9562 version 7 ids', () => {
    const ids = new UuidV7Generator();
    for (let i = 0; i < 100; i++) {
      expect(isUuidV7(ids.next())).toBe(true);
    }
  });

  it('encodes the timestamp in the first 48 bits', () => {
    const ms = Date.UTC(2026, 10, 7, 19, 0, 0);
    const id = new UuidV7Generator(() => ms).next();
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ms);
  });

  it('is strictly increasing within the same millisecond', () => {
    const ids = new UuidV7Generator(() => 1_700_000_000_000);
    const generated = Array.from({ length: 5000 }, () => ids.next());
    expect([...generated].sort()).toEqual(generated);
    expect(new Set(generated).size).toBe(generated.length);
  });

  it('stays increasing when the clock goes backwards', () => {
    let now = 1_700_000_000_500;
    const ids = new UuidV7Generator(() => now);
    const first = ids.next();
    now -= 400;
    const second = ids.next();
    expect(second > first).toBe(true);
  });

  it('sorts by creation time across milliseconds', () => {
    let now = 1_700_000_000_000;
    const ids = new UuidV7Generator(() => now++);
    const generated = Array.from({ length: 100 }, () => ids.next());
    expect([...generated].sort()).toEqual(generated);
  });
});
