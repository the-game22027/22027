import { Inject, Injectable } from '@nestjs/common';
import { type PublicUser, UsersFacade } from '@modules/users';
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  type Page,
  type PageRequest,
} from '@shared/kernel';
import { orderFriendPair } from '../domain/friend-pair';
import { describeRelationship, type Relationship } from '../domain/friend-request-rules';
import { UserNotFoundError } from '../domain/social-errors';
import {
  type FriendRequestStatus,
  type NewestFirstPosition,
  SOCIAL_REPOSITORY,
  type SocialRepository,
} from './ports/social-repository';

export interface FriendRequestView {
  id: string;
  from: PublicUser;
  to: PublicUser;
  status: FriendRequestStatus;
  createdAt: Date;
}

export interface ConnectedUserView {
  user: PublicUser;
  since: Date;
}

export interface UserProfileView extends PublicUser {
  relationship: Relationship;
  requestId: string | null;
}

const isNewestFirstPosition = (value: Record<string, unknown>): value is { at: string; id: string } =>
  typeof value['at'] === 'string' && !Number.isNaN(Date.parse(value['at'])) && typeof value['id'] === 'string';

const isSearchPosition = (value: Record<string, unknown>): value is { displayName: string; id: string } =>
  typeof value['displayName'] === 'string' && typeof value['id'] === 'string';

/** The social lists and profiles the HTTP API shows (03 §7.1), with each player's public profile. */
@Injectable()
export class SocialPages {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly social: SocialRepository,
    private readonly users: UsersFacade,
  ) {}

  async listPendingRequests(
    userId: string,
    direction: 'incoming' | 'outgoing',
    page: Partial<PageRequest>,
  ): Promise<Page<FriendRequestView>> {
    const limit = clampLimit(page.limit);
    const rows = await this.social.listPendingRequests(userId, direction, this.newestFirstFrom(page.cursor), limit + 1);
    const items = rows.slice(0, limit);
    const users = await this.publicUsersById(items.flatMap((row) => [row.requesterId, row.addresseeId]));
    return {
      items: items.flatMap((row) => {
        const [from, to] = [users.get(row.requesterId), users.get(row.addresseeId)];
        return from && to ? [{ id: row.id, from, to, status: row.status, createdAt: row.createdAt }] : [];
      }),
      nextCursor: this.nextNewestFirstCursor(rows, limit, (row) => ({ at: row.createdAt, id: row.id })),
    };
  }

  /** Builds a request's view after a change (send, accept, decline). */
  async viewFriendRequest(request: {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: FriendRequestStatus;
    createdAt: Date;
  }): Promise<FriendRequestView> {
    const users = await this.publicUsersById([request.requesterId, request.addresseeId]);
    const [from, to] = [users.get(request.requesterId), users.get(request.addresseeId)];
    if (!from || !to) throw new UserNotFoundError();
    return { id: request.id, from, to, status: request.status, createdAt: request.createdAt };
  }

  listFriends(userId: string, page: Partial<PageRequest>): Promise<Page<ConnectedUserView>> {
    return this.listConnectedUsers(page, (after, limit) => this.social.listFriends(userId, after, limit));
  }

  listBlockedUsers(userId: string, page: Partial<PageRequest>): Promise<Page<ConnectedUserView>> {
    return this.listConnectedUsers(page, (after, limit) => this.social.listBlockedUsers(userId, after, limit));
  }

  /** A block in either direction looks like an unknown player (03 §7.1). */
  async getUserProfile(viewerId: string, userId: string): Promise<UserProfileView> {
    if (viewerId !== userId && (await this.social.isBlockedEitherWay(viewerId, userId))) throw new UserNotFoundError();
    const account = await this.users.getAccount(userId);
    const [user] = await this.users.findPublicUsers([userId]);
    if (!account || account.status !== 'ACTIVE' || !user) throw new UserNotFoundError();
    const pair = orderFriendPair(viewerId, userId);
    const facts =
      viewerId === userId
        ? { friends: false, pending: null }
        : { friends: await this.social.areFriends(pair), pending: await this.social.findPendingRequestBetween(pair) };
    return { ...user, ...describeRelationship(viewerId, userId, facts) };
  }

  /** Never yourself, never a block either way (03 §7.1). */
  async searchUsers(viewerId: string, text: string, page: Partial<PageRequest>): Promise<Page<PublicUser>> {
    const limit = clampLimit(page.limit);
    let after: { displayName: string; id: string } | null = null;
    if (page.cursor !== undefined) {
      const decoded = decodeCursor(page.cursor);
      if (!decoded || !isSearchPosition(decoded)) throw new InvalidCursorError();
      after = { displayName: decoded.displayName, id: decoded.id };
    }
    const excludedUserIds = [viewerId, ...(await this.social.listUserIdsBlockedEitherWay(viewerId))];
    const rows = await this.users.searchActiveUsers({ text, excludedUserIds, after, limit: limit + 1 });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor({ displayName: last.displayName, id: last.id }) : null,
    };
  }

  private async listConnectedUsers(
    page: Partial<PageRequest>,
    load: (after: NewestFirstPosition | null, limit: number) => Promise<{ userId: string; since: Date }[]>,
  ): Promise<Page<ConnectedUserView>> {
    const limit = clampLimit(page.limit);
    const rows = await load(this.newestFirstFrom(page.cursor), limit + 1);
    const items = rows.slice(0, limit);
    const users = await this.publicUsersById(items.map((row) => row.userId));
    return {
      items: items.flatMap((row) => {
        const user = users.get(row.userId);
        return user ? [{ user, since: row.since }] : [];
      }),
      nextCursor: this.nextNewestFirstCursor(rows, limit, (row) => ({ at: row.since, id: row.userId })),
    };
  }

  private newestFirstFrom(cursor: string | undefined): NewestFirstPosition | null {
    if (cursor === undefined) return null;
    const decoded = decodeCursor(cursor);
    if (!decoded || !isNewestFirstPosition(decoded)) throw new InvalidCursorError();
    return { at: new Date(decoded.at), id: decoded.id };
  }

  private nextNewestFirstCursor<T>(
    rows: T[],
    limit: number,
    positionOf: (row: T) => NewestFirstPosition,
  ): string | null {
    const last = rows.slice(0, limit).at(-1);
    if (rows.length <= limit || !last) return null;
    const { at, id } = positionOf(last);
    return encodeCursor({ at: at.toISOString(), id });
  }

  private async publicUsersById(userIds: string[]): Promise<Map<string, PublicUser>> {
    const users = await this.users.findPublicUsers([...new Set(userIds)]);
    return new Map(users.map((user) => [user.id, user]));
  }
}
