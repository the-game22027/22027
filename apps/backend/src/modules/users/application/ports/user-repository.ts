import type { NewUser, ProfilePatch, UserAccount } from '../user-account';

export interface UserRepository {
  create(user: NewUser): Promise<void>;
  findAccount(userId: string): Promise<UserAccount | null>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
