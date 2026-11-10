export interface OutboxRetryPolicy {
  readonly retryBaseMs: number;
  readonly retryMaxMs: number;
}

/** Exponential with equal jitter: at least half the ceiling, so retries always wait and never move in step. */
export function outboxRetryDelayMs(
  attempts: number,
  policy: OutboxRetryPolicy,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(policy.retryMaxMs, policy.retryBaseMs * 2 ** (attempts - 1));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
