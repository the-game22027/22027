import type { ParticipantId } from '../game-rules';

/** Wrong tries per player and until when each is locked out (08 §9.2). */
export type Lockouts = Readonly<Record<ParticipantId, { wrongTries: number; lockedUntil: Date | null }>>;

export const noLockouts = (participants: readonly ParticipantId[]): Lockouts =>
  Object.fromEntries(participants.map((id) => [id, { wrongTries: 0, lockedUntil: null }]));

/** The next step of `lockoutMs` for this player; after the last step, the last value repeats. */
export const lockOutAfterWrongTry = (
  lockouts: Lockouts,
  who: ParticipantId,
  now: Date,
  lockoutMs: readonly number[],
): Lockouts => {
  const wrongTries = (lockouts[who]?.wrongTries ?? 0) + 1;
  const stepMs = lockoutMs[Math.min(wrongTries, lockoutMs.length) - 1] ?? 0;
  return { ...lockouts, [who]: { wrongTries, lockedUntil: new Date(now.getTime() + stepMs) } };
};

/** When the player may try again, or null when they may try now. */
export const findLockedUntil = (lockouts: Lockouts, who: ParticipantId, now: Date): Date | null => {
  const lockedUntil = lockouts[who]?.lockedUntil ?? null;
  return lockedUntil && lockedUntil.getTime() > now.getTime() ? lockedUntil : null;
};
