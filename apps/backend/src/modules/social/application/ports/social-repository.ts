import type { FriendPair } from '../../domain/friend-pair';

export const SOCIAL_REPOSITORY = Symbol('SOCIAL_REPOSITORY');

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export interface StoredFriendRequest {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendRequestStatus;
  createdAt: Date;
}

/** Keyset position for lists ordered newest first: the last row's time and id. */
export interface NewestFirstPosition {
  at: Date;
  id: string;
}

export interface SocialRepository {
  /** Holds until the transaction ends, so every change between two players runs one at a time. */
  waitForOtherChangesOfPair(pair: FriendPair): Promise<void>;
  findPendingRequestBetween(pair: FriendPair): Promise<StoredFriendRequest | null>;
  /** false when a pending request between the two already exists (the partial unique index). */
  insertPendingRequest(request: StoredFriendRequest): Promise<boolean>;
  findFriendRequest(requestId: string): Promise<StoredFriendRequest | null>;
  /** Only a PENDING request changes; false when it was no longer pending. */
  closePendingRequest(requestId: string, status: Exclude<FriendRequestStatus, 'PENDING'>, at: Date): Promise<boolean>;
  cancelPendingRequestsBetween(pair: FriendPair, at: Date): Promise<void>;
  insertFriendship(pair: FriendPair, at: Date): Promise<void>;
  /** false when they were not friends. */
  deleteFriendship(pair: FriendPair): Promise<boolean>;
  areFriends(pair: FriendPair): Promise<boolean>;
  /** false when this block already existed. */
  insertBlock(blockerId: string, blockedId: string, at: Date): Promise<boolean>;
  deleteBlock(blockerId: string, blockedId: string): Promise<void>;
  isBlockedEitherWay(userA: string, userB: string): Promise<boolean>;
  /** Every block, either direction, between any two of these users. */
  findBlockedPairs(userIds: readonly string[]): Promise<[string, string][]>;
  listUserIdsBlockedEitherWay(userId: string): Promise<string[]>;
  listFriendIds(userId: string): Promise<string[]>;
  listPendingRequests(
    userId: string,
    direction: 'incoming' | 'outgoing',
    after: NewestFirstPosition | null,
    limit: number,
  ): Promise<StoredFriendRequest[]>;
  listFriends(
    userId: string,
    after: NewestFirstPosition | null,
    limit: number,
  ): Promise<{ userId: string; since: Date }[]>;
  listBlockedUsers(
    blockerId: string,
    after: NewestFirstPosition | null,
    limit: number,
  ): Promise<{ userId: string; since: Date }[]>;
}
