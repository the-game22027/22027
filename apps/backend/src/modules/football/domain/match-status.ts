export const MATCH_STATUSES = ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED', 'ABANDONED'] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** For display only: the prediction write checks the same rule again with the database clock. */
export function isPredictable(status: MatchStatus, kickoffAt: Date, now: Date): boolean {
  return status === 'SCHEDULED' && kickoffAt.getTime() > now.getTime();
}
