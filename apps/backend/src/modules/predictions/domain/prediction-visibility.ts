/** What decides whether a viewer may see another player's prediction (03 §7). */
export interface PredictionVisibilityFacts {
  viewerId: string;
  ownerId: string;
  areFriends: boolean;
  blockedEitherWay: boolean;
  /** By the database clock, the one that locks the prediction (DEC-21). */
  kickoffPassed: boolean;
}

/**
 * The only place the rule lives (DEC-21): you always see your own; friends see each other's once kickoff has
 * passed, when the prediction can no longer change; nobody else ever does.
 */
export function canViewPrediction(facts: PredictionVisibilityFacts): boolean {
  if (facts.viewerId === facts.ownerId) return true;
  if (facts.blockedEitherWay || !facts.areFriends) return false;
  return facts.kickoffPassed;
}
