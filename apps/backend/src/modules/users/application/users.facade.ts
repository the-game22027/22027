import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '@shared/infrastructure/config';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { chosenDisplayName, displayNameFrom } from '../domain/display-name';
import { assertValidUsername } from '../domain/username';
import { USER_REPOSITORY, type UserRepository } from './ports/user-repository';
import type { ProfilePatch, PublicUser, UserAccount, UserSearch } from './user-account';

export interface IdentityHints {
  readonly displayName?: string;
  readonly avatarUrl?: string;
}

@Injectable()
export class UsersFacade {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfig,
    private readonly outbox: OutboxWriter,
  ) {}

  /** Joins the caller's transaction, so a failed sign-in leaves no orphan user. */
  async createFromIdentity(hints: IdentityHints): Promise<string> {
    const id = this.ids.next();
    await this.users.create({
      id,
      displayName: displayNameFrom(hints.displayName, () => randomBytes(2).toString('hex')),
      avatarUrl: hints.avatarUrl ?? null,
    });
    return id;
  }

  getAccount(userId: string): Promise<UserAccount | null> {
    return this.users.findAccount(userId);
  }

  /** Users without a profile are left out. */
  findPublicUsers(userIds: readonly string[]): Promise<PublicUser[]> {
    return this.users.findPublicUsers(userIds);
  }

  /** Active users only; `excludedUserIds` never appear (blocks, the caller). */
  searchActiveUsers(search: UserSearch): Promise<PublicUser[]> {
    return this.users.searchActiveUsers(search);
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    if (patch.username) assertValidUsername(patch.username, this.config.profile.usernamePattern);
    await this.users.updateProfile(userId, {
      ...patch,
      ...(patch.displayName === undefined ? {} : { displayName: chosenDisplayName(patch.displayName) }),
    });
  }

  /** Soft delete: the row stays through the grace period, so signing in can still undo it. */
  @Transactional()
  async requestDeletion(userId: string): Promise<void> {
    if (await this.users.markPendingDeletion(userId, this.clock.now())) {
      await this.publish('UserDeletionRequested', userId);
    }
  }

  @Transactional()
  async cancelDeletion(userId: string): Promise<void> {
    if (await this.users.cancelPendingDeletion(userId)) {
      await this.publish('UserDeletionCancelled', userId);
    }
  }

  private async publish(type: string, userId: string): Promise<void> {
    await this.outbox.write({ type, version: 1, aggregateType: 'user', aggregateId: userId, payload: { userId } });
  }
}
