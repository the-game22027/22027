import type { Locale } from '@shared/kernel';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION' | 'DELETED';

export interface UserAccount {
  readonly id: string;
  readonly status: UserStatus;
  readonly displayName: string;
  readonly username: string | null;
  readonly avatarUrl: string | null;
  readonly locale: Locale;
  readonly favouriteTeamId: string | null;
  readonly predictionVisibility: string | null;
}

/** What any player may see of another (docs/api/API.md §5 `PublicUser`). */
export interface PublicUser {
  readonly id: string;
  readonly displayName: string;
  readonly username: string | null;
  readonly avatarUrl: string | null;
}

export interface NewUser {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface ProfilePatch {
  readonly displayName?: string;
  readonly username?: string | null;
  readonly avatarUrl?: string | null;
  readonly locale?: Locale;
  readonly favouriteTeamId?: string | null;
}
