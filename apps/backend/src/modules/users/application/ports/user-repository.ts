import type { NewUser, ProfilePatch, PublicUser, UserAccount } from '../user-account';

export interface UserRepository {
  create(user: NewUser): Promise<void>;
  findAccount(userId: string): Promise<UserAccount | null>;
  findPublicUsers(userIds: readonly string[]): Promise<PublicUser[]>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<void>;
  markPendingDeletion(userId: string, now: Date): Promise<boolean>;
  cancelPendingDeletion(userId: string): Promise<boolean>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
