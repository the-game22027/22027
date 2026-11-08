export interface SessionState {
  readonly revokedAt: Date | null;
  readonly replacedBySessionId: string | null;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export type RefreshVerdict = 'ACTIVE' | 'REUSED' | 'REVOKED' | 'EXPIRED';

export type RevokeReason = 'ROTATED' | 'REUSE_DETECTED' | 'LOGOUT' | 'REVOKED_BY_USER' | 'ACCOUNT_DISABLED';

const DAY_MS = 24 * 60 * 60 * 1000;

export function assessRefresh(session: SessionState, now: Date): RefreshVerdict {
  // A rotated token showing up again means two parties hold the same token: one of them stole it.
  if (session.revokedAt) return session.replacedBySessionId ? 'REUSED' : 'REVOKED';
  if (now >= session.expiresAt || now >= session.absoluteExpiresAt) return 'EXPIRED';
  return 'ACTIVE';
}

export function slidingExpiry(now: Date, slidingDays: number, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + slidingDays * DAY_MS, absoluteExpiresAt.getTime()));
}

export function absoluteExpiry(now: Date, absoluteDays: number): Date {
  return new Date(now.getTime() + absoluteDays * DAY_MS);
}
