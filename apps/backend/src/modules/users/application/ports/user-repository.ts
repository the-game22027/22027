import type { NewUser, UserAccount } from '../user-account';

export interface UserRepository {
  create(user: NewUser): Promise<void>;
  findAccount(userId: string): Promise<UserAccount | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
