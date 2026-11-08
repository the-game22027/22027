import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { displayNameFrom } from '../domain/display-name';
import { USER_REPOSITORY, type UserRepository } from './ports/user-repository';
import type { UserAccount } from './user-account';

export interface IdentityHints {
  readonly displayName?: string;
  readonly avatarUrl?: string;
}

@Injectable()
export class UsersFacade {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
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
}
