export const ACTIVITY_GUARD = Symbol('ACTIVITY_GUARD');

/** What a user is doing right now: at most one at a time (WEBSOCKET.md §7). */
export type Activity = `QUEUE:${string}` | `BATTLE:${string}`;

/** "One activity per user", shared by every API instance (Redis `act:{userId}`, 02 §4.8). */
export interface ActivityGuard {
  /** False when the user already has another activity. */
  claimActivity(userId: string, activity: Activity): Promise<boolean>;
  /** Moves the user from one activity to the next only if they are still in the first. */
  replaceActivity(userId: string, from: Activity, to: Activity): Promise<boolean>;
  /** Ends the activity only if it is still the current one, so a late release cannot end a newer one. */
  releaseActivity(userId: string, activity: Activity): Promise<void>;
  findActivity(userId: string): Promise<Activity | null>;
  /** Ends every queue activity; single-instance only, for boot after a crash (P6.3 moves the queue to Redis). */
  releaseEveryQueueActivity(): Promise<number>;
}
