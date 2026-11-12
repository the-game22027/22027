import {
  AlreadyFriendsError,
  CannotTargetYourselfError,
  FriendRequestExistsError,
  UserNotFoundError,
} from './social-errors';

/** What is true between two players when one sends a friend request (03 §7.1). */
export interface FriendRequestFacts {
  requesterId: string;
  addresseeId: string;
  addresseeIsActive: boolean;
  blockedEitherWay: boolean;
  alreadyFriends: boolean;
  /** The pending request between them, sent by either one. */
  pending: { id: string; requesterId: string } | null;
}

export type FriendRequestDecision = { kind: 'CREATE' } | { kind: 'RETURN_EXISTING'; requestId: string };

/** Decides a friend request, or throws the error the caller gets. A block looks like an unknown player. */
export function decideFriendRequest(facts: FriendRequestFacts): FriendRequestDecision {
  if (facts.requesterId === facts.addresseeId) throw new CannotTargetYourselfError();
  if (!facts.addresseeIsActive || facts.blockedEitherWay) throw new UserNotFoundError();
  if (facts.alreadyFriends) throw new AlreadyFriendsError();
  if (facts.pending) {
    if (facts.pending.requesterId === facts.requesterId)
      return { kind: 'RETURN_EXISTING', requestId: facts.pending.id };
    throw new FriendRequestExistsError(facts.pending.id);
  }
  return { kind: 'CREATE' };
}

export type Relationship = 'SELF' | 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';

/** How a viewer stands with another player, for their profile (03 §7.1). */
export function describeRelationship(
  viewerId: string,
  otherId: string,
  facts: { friends: boolean; pending: { id: string; requesterId: string } | null },
): { relationship: Relationship; requestId: string | null } {
  if (viewerId === otherId) return { relationship: 'SELF', requestId: null };
  if (facts.friends) return { relationship: 'FRIENDS', requestId: null };
  if (facts.pending) {
    return {
      relationship: facts.pending.requesterId === viewerId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED',
      requestId: facts.pending.id,
    };
  }
  return { relationship: 'NONE', requestId: null };
}
