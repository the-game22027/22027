export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION' | 'DELETED';

export interface UserAccount {
  readonly id: string;
  readonly status: UserStatus;
  readonly displayName: string;
  readonly username: string | null;
  readonly avatarUrl: string | null;
  readonly locale: string;
  readonly predictionVisibility: string | null;
}

export interface NewUser {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}
