import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '@shared/infrastructure/config';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { chosenDisplayName, displayNameFrom } from '../domain/display-name';
import { assertValidUsername } from '../domain/username';
import { USER_REPOSITORY, type UserRepository } from './ports/user-repository';
import type { ProfilePatch, UserAccount } from './user-account';

export interface IdentityHints {
  readonly displayName?: string;
  readonly avatarUrl?: string;
}

@Injectable()
export class UsersFacade {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly config: AppConfig,
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

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    if (patch.username) assertValidUsername(patch.username, this.config.profile.usernamePattern);
    await this.users.updateProfile(userId, {
      ...patch,
      ...(patch.displayName === undefined ? {} : { displayName: chosenDisplayName(patch.displayName) }),
    });
  }
}
