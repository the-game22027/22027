import { FixedClock } from './clock';

describe('FixedClock', () => {
  it('returns the same instant until moved', () => {
    const clock = new FixedClock('2026-11-07T19:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-07T19:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-07T19:00:00.000Z');
  });

  it('advances and can be set', () => {
    const clock = new FixedClock('2026-11-07T19:00:00.000Z');
    clock.advanceBy(1500);
    expect(clock.now().toISOString()).toBe('2026-11-07T19:00:01.500Z');
    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns copies, so callers cannot mutate its time', () => {
    const clock = new FixedClock('2026-11-07T19:00:00.000Z');
    clock.now().setUTCFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});
