import { Inject, Injectable } from '@nestjs/common';
import { orderFriendPair } from '../domain/friend-pair';
import { SOCIAL_REPOSITORY, type SocialRepository } from './ports/social-repository';

/** What other modules may ask about relationships (01 §2.12). Each module's own policy decides what that allows. */
@Injectable()
export class SocialQuery {
  constructor(@Inject(SOCIAL_REPOSITORY) private readonly social: SocialRepository) {}

  areFriends(userA: string, userB: string): Promise<boolean> {
    return userA === userB ? Promise.resolve(false) : this.social.areFriends(orderFriendPair(userA, userB));
  }

  listFriendIds(userId: string): Promise<string[]> {
    return this.social.listFriendIds(userId);
  }

  /** A block in either direction. */
  isBlocked(userA: string, userB: string): Promise<boolean> {
    return this.social.isBlockedEitherWay(userA, userB);
  }

  /** Every blocked pair among these users, either direction: the matchmaker never pairs them (03 §7.1). */
  findBlockedPairs(userIds: readonly string[]): Promise<[string, string][]> {
    return userIds.length < 2 ? Promise.resolve([]) : this.social.findBlockedPairs(userIds);
  }
}
