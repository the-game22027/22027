import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { Prisma } from '@generated/prisma/client';
import type {
  FriendRequestStatus,
  NewestFirstPosition,
  SocialRepository,
  StoredFriendRequest,
} from '../application/ports/social-repository';
import type { FriendPair } from '../domain/friend-pair';

interface ConnectedUserRow {
  user_id: string;
  since: Date;
}

const pendingBetween = ({ userLowId, userHighId }: FriendPair) => ({
  status: 'PENDING' as const,
  OR: [
    { requesterId: userLowId, addresseeId: userHighId },
    { requesterId: userHighId, addresseeId: userLowId },
  ],
});

const toStoredRequest = (row: {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendRequestStatus;
  createdAt: Date;
}): StoredFriendRequest => ({
  id: row.id,
  requesterId: row.requesterId,
  addresseeId: row.addresseeId,
  status: row.status,
  createdAt: row.createdAt,
});

/** Newest first, ties by id: `(created_at, id) < (at, id)` is "after" in that order. */
const olderThan = (after: NewestFirstPosition | null, at: Prisma.Sql, id: Prisma.Sql) =>
  after ? Prisma.sql`AND (${at}, ${id}) < (${after.at}, ${after.id}::uuid)` : Prisma.empty;

@Injectable()
export class PrismaSocialRepository implements SocialRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async waitForOtherChangesOfPair({ userLowId, userHighId }: FriendPair): Promise<void> {
    await this.txHost.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`social:${userLowId}:${userHighId}`}))`;
  }

  async findPendingRequestBetween(pair: FriendPair): Promise<StoredFriendRequest | null> {
    const row = await this.txHost.tx.friendRequest.findFirst({ where: pendingBetween(pair) });
    return row && toStoredRequest(row);
  }

  async insertPendingRequest(request: StoredFriendRequest): Promise<boolean> {
    // DO NOTHING keeps the transaction usable; a unique violation would abort it.
    const inserted = await this.txHost.tx.$executeRaw`
      INSERT INTO friend_requests (id, requester_id, addressee_id, status, created_at)
      VALUES (${request.id}::uuid, ${request.requesterId}::uuid, ${request.addresseeId}::uuid, 'PENDING', ${request.createdAt})
      ON CONFLICT DO NOTHING`;
    return inserted === 1;
  }

  async findFriendRequest(requestId: string): Promise<StoredFriendRequest | null> {
    const row = await this.txHost.tx.friendRequest.findUnique({ where: { id: requestId } });
    return row && toStoredRequest(row);
  }

  async closePendingRequest(
    requestId: string,
    status: Exclude<FriendRequestStatus, 'PENDING'>,
    at: Date,
  ): Promise<boolean> {
    const { count } = await this.txHost.tx.friendRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status, respondedAt: at },
    });
    return count === 1;
  }

  async cancelPendingRequestsBetween(pair: FriendPair, at: Date): Promise<void> {
    await this.txHost.tx.friendRequest.updateMany({
      where: pendingBetween(pair),
      data: { status: 'CANCELLED', respondedAt: at },
    });
  }

  async insertFriendship(pair: FriendPair, at: Date): Promise<void> {
    await this.txHost.tx.friendship.createMany({ data: [{ ...pair, createdAt: at }], skipDuplicates: true });
  }

  async deleteFriendship(pair: FriendPair): Promise<boolean> {
    const { count } = await this.txHost.tx.friendship.deleteMany({ where: pair });
    return count === 1;
  }

  async areFriends(pair: FriendPair): Promise<boolean> {
    return (await this.txHost.tx.friendship.count({ where: pair })) === 1;
  }

  async insertBlock(blockerId: string, blockedId: string, at: Date): Promise<boolean> {
    const { count } = await this.txHost.tx.userBlock.createMany({
      data: [{ blockerId, blockedId, createdAt: at }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async deleteBlock(blockerId: string, blockedId: string): Promise<void> {
    await this.txHost.tx.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }

  async isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    const count = await this.txHost.tx.userBlock.count({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
    return count > 0;
  }

  async findBlockedPairs(userIds: readonly string[]): Promise<[string, string][]> {
    const blocks = await this.txHost.tx.userBlock.findMany({
      where: { blockerId: { in: [...userIds] }, blockedId: { in: [...userIds] } },
      select: { blockerId: true, blockedId: true },
    });
    return blocks.map(({ blockerId, blockedId }) => [blockerId, blockedId]);
  }

  async listUserIdsBlockedEitherWay(userId: string): Promise<string[]> {
    const blocks = await this.txHost.tx.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return blocks.map(({ blockerId, blockedId }) => (blockerId === userId ? blockedId : blockerId));
  }

  async listFriendIds(userId: string): Promise<string[]> {
    const rows = await this.txHost.tx.friendship.findMany({
      where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
      select: { userLowId: true, userHighId: true },
    });
    return rows.map(({ userLowId, userHighId }) => (userLowId === userId ? userHighId : userLowId));
  }

  async listPendingRequests(
    userId: string,
    direction: 'incoming' | 'outgoing',
    after: NewestFirstPosition | null,
    limit: number,
  ): Promise<StoredFriendRequest[]> {
    const rows = await this.txHost.tx.friendRequest.findMany({
      where: {
        status: 'PENDING',
        ...(direction === 'incoming' ? { addresseeId: userId } : { requesterId: userId }),
        ...(after ? { OR: [{ createdAt: { lt: after.at } }, { createdAt: after.at, id: { lt: after.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toStoredRequest);
  }

  async listFriends(
    userId: string,
    after: NewestFirstPosition | null,
    limit: number,
  ): Promise<{ userId: string; since: Date }[]> {
    const rows = await this.txHost.tx.$queryRaw<ConnectedUserRow[]>`
      SELECT friend.user_id, friend.since FROM (
        SELECT CASE WHEN user_low_id = ${userId}::uuid THEN user_high_id ELSE user_low_id END AS user_id,
               created_at AS since
        FROM friendships
        WHERE user_low_id = ${userId}::uuid OR user_high_id = ${userId}::uuid
      ) friend
      WHERE TRUE ${olderThan(after, Prisma.sql`friend.since`, Prisma.sql`friend.user_id`)}
      ORDER BY friend.since DESC, friend.user_id DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({ userId: row.user_id, since: row.since }));
  }

  async listBlockedUsers(
    blockerId: string,
    after: NewestFirstPosition | null,
    limit: number,
  ): Promise<{ userId: string; since: Date }[]> {
    const rows = await this.txHost.tx.$queryRaw<ConnectedUserRow[]>`
      SELECT blocked_id::text AS user_id, created_at AS since
      FROM user_blocks
      WHERE blocker_id = ${blockerId}::uuid ${olderThan(after, Prisma.sql`created_at`, Prisma.sql`blocked_id`)}
      ORDER BY created_at DESC, blocked_id DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({ userId: row.user_id, since: row.since }));
  }
}
