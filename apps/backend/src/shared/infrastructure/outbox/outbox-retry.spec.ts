import { outboxRetryDelayMs } from './outbox-retry';

const policy = { retryBaseMs: 1000, retryMaxMs: 60_000 };

describe('outboxRetryDelayMs', () => {
  it('doubles the ceiling with each attempt', () => {
    expect([1, 2, 3, 4].map((attempts) => outboxRetryDelayMs(attempts, policy, () => 1))).toEqual([
      1000, 2000, 4000, 8000,
    ]);
  });

  it('waits at least half the ceiling', () => {
    expect(outboxRetryDelayMs(3, policy, () => 0)).toBe(2000);
  });

  it('never exceeds the maximum, even after very many attempts', () => {
    expect(outboxRetryDelayMs(10_000, policy, () => 1)).toBe(60_000);
  });

  it('takes its numbers from the policy', () => {
    expect(outboxRetryDelayMs(2, { retryBaseMs: 10, retryMaxMs: 15 }, () => 1)).toBe(15);
  });
});
