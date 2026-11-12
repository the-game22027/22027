/** A friendship is stored once per pair, lower id first (02 §4.12), so (a, b) and (b, a) are the same row. */
export interface FriendPair {
  userLowId: string;
  userHighId: string;
}

/** UUIDs are lowercase hex of equal length, so string order is the same order Postgres uses for `uuid`. */
export function orderFriendPair(userA: string, userB: string): FriendPair {
  return userA < userB ? { userLowId: userA, userHighId: userB } : { userLowId: userB, userHighId: userA };
}
