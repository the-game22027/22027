import { Inject, Injectable } from '@nestjs/common';
import { UsersFacade } from '@modules/users';
import type { AuthProvider } from '../domain/auth-provider';
import { IDENTITY_REPOSITORY, type IdentityRepository } from './ports/identity-repository';

export interface MeView {
  readonly id: string;
  readonly displayName: string;
  readonly username: string | null;
  readonly avatarUrl: string | null;
  readonly locale: string;
  readonly favouriteTeamId: string | null;
  readonly identities: readonly { id: string; provider: AuthProvider; label: string }[];
  readonly privacy: { readonly predictionVisibility: string | null };
}

// Lives in auth, not users: users must not depend on auth, and "me" includes the sign-in identities.
@Injectable()
export class MeQuery {
  constructor(
    private readonly users: UsersFacade,
    @Inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
  ) {}

  async forUser(userId: string): Promise<MeView> {
    const [account, identities] = await Promise.all([
      this.users.getAccount(userId),
      this.identities.listForUser(userId),
    ]);
    if (!account) throw new Error(`User ${userId} has a session but no account`);
    return {
      id: account.id,
      displayName: account.displayName,
      username: account.username,
      avatarUrl: account.avatarUrl,
      locale: account.locale,
      favouriteTeamId: account.favouriteTeamId,
      identities: identities.map((identity) => ({
        id: identity.id,
        provider: identity.provider,
        label: identity.email ?? identity.displayName ?? identity.provider,
      })),
      privacy: { predictionVisibility: account.predictionVisibility },
    };
  }
}
