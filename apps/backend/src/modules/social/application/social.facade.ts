import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UsersFacade } from '@modules/users';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { type FriendPair, orderFriendPair } from '../domain/friend-pair';
import { decideFriendRequest } from '../domain/friend-request-rules';
import {
  CannotTargetYourselfError,
  FriendRequestNotFoundError,
  FriendRequestNotPendingError,
  UserNotFoundError,
} from '../domain/social-errors';
import { SOCIAL_REPOSITORY, type SocialRepository, type StoredFriendRequest } from './ports/social-repository';

/**
 * Friend requests, friendships and blocks (03 §7.1). Every change between two players takes a lock on
 * that pair first, so a block can never slip past a request being sent at the same moment.
 */
@Injectable()
export class SocialFacade {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly social: SocialRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly users: UsersFacade,
    private readonly outbox: OutboxWriter,
  ) {}

  /** `created` is false when the same request was already pending: sending twice changes nothing. */
  @Transactional()
  async sendFriendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<{ request: StoredFriendRequest; created: boolean }> {
    if (requesterId === addresseeId) throw new CannotTargetYourselfError();
    const pair = orderFriendPair(requesterId, addresseeId);
    await this.social.waitForOtherChangesOfPair(pair);
    const pending = await this.social.findPendingRequestBetween(pair);
    const decision = decideFriendRequest({
      requesterId,
      addresseeId,
      addresseeIsActive: (await this.users.getAccount(addresseeId))?.status === 'ACTIVE',
      blockedEitherWay: await this.social.isBlockedEitherWay(requesterId, addresseeId),
      alreadyFriends: await this.social.areFriends(pair),
      pending,
    });
    if (decision.kind === 'RETURN_EXISTING' && pending) return { request: pending, created: false };
    const request: StoredFriendRequest = {
      id: this.ids.next(),
      requesterId,
      addresseeId,
      status: 'PENDING',
      createdAt: this.clock.now(),
    };
    // The pair lock rules out a conflict here; the unique index still guards the rule for any other writer.
    if (!(await this.social.insertPendingRequest(request))) {
      throw new Error('A pending friend request appeared under the pair lock');
    }
    return { request, created: true };
  }

  @Transactional()
  async acceptFriendRequest(requestId: string, userId: string): Promise<StoredFriendRequest> {
    const request = await this.closeRequest(requestId, userId, 'addressee', 'ACCEPTED');
    const pair = orderFriendPair(request.requesterId, request.addresseeId);
    await this.social.insertFriendship(pair, this.clock.now());
    await this.writePairEvent('FriendshipCreated', pair, {});
    return request;
  }

  @Transactional()
  async declineFriendRequest(requestId: string, userId: string): Promise<StoredFriendRequest> {
    return this.closeRequest(requestId, userId, 'addressee', 'DECLINED');
  }

  @Transactional()
  async cancelFriendRequest(requestId: string, userId: string): Promise<void> {
    await this.closeRequest(requestId, userId, 'requester', 'CANCELLED');
  }

  /** Not friends is fine: the result is the same. */
  @Transactional()
  async unfriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) return;
    const pair = orderFriendPair(userId, friendId);
    await this.social.waitForOtherChangesOfPair(pair);
    if (await this.social.deleteFriendship(pair)) {
      await this.writePairEvent('FriendshipRemoved', pair, { reason: 'UNFRIENDED' });
    }
  }

  /** Ends the friendship and every pending request between the two, in one transaction (03 §7.1). */
  @Transactional()
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) throw new CannotTargetYourselfError();
    const account = await this.users.getAccount(blockedId);
    if (!account || account.status === 'DELETED') throw new UserNotFoundError();
    const pair = orderFriendPair(blockerId, blockedId);
    await this.social.waitForOtherChangesOfPair(pair);
    const now = this.clock.now();
    if (!(await this.social.insertBlock(blockerId, blockedId, now))) return;
    await this.social.cancelPendingRequestsBetween(pair, now);
    if (await this.social.deleteFriendship(pair)) {
      await this.writePairEvent('FriendshipRemoved', pair, { reason: 'BLOCKED' });
    }
    await this.outbox.write({
      type: 'UserBlocked',
      version: 1,
      aggregateType: 'user',
      aggregateId: blockerId,
      payload: { blockerId, blockedId },
    });
  }

  /** Restores nothing: no friendship, no requests. */
  @Transactional()
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.social.deleteBlock(blockerId, blockedId);
  }

  private async closeRequest(
    requestId: string,
    userId: string,
    actor: 'requester' | 'addressee',
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED',
  ): Promise<StoredFriendRequest> {
    const found = await this.social.findFriendRequest(requestId);
    const ownerId = actor === 'requester' ? found?.requesterId : found?.addresseeId;
    if (!found || ownerId !== userId) throw new FriendRequestNotFoundError();
    await this.social.waitForOtherChangesOfPair(orderFriendPair(found.requesterId, found.addresseeId));
    if (!(await this.social.closePendingRequest(requestId, status, this.clock.now()))) {
      throw new FriendRequestNotPendingError();
    }
    return { ...found, status };
  }

  private async writePairEvent(type: string, pair: FriendPair, extra: Record<string, unknown>): Promise<void> {
    await this.outbox.write({
      type,
      version: 1,
      aggregateType: 'friendship',
      aggregateId: pair.userLowId,
      payload: { userA: pair.userLowId, userB: pair.userHighId, ...extra },
    });
  }
}
