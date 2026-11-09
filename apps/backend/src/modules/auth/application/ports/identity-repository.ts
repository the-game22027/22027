import type { AuthProvider } from '../../domain/auth-provider';

export interface IdentityRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: AuthProvider;
  readonly email: string | null;
  readonly displayName: string | null;
}

export interface IdentityProfile {
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName: string | null;
}

export interface NewIdentity extends IdentityProfile {
  readonly id: string;
  readonly userId: string;
  readonly provider: AuthProvider;
  readonly subject: string;
  readonly now: Date;
}

export interface IdentityRepository {
  findBySubject(provider: AuthProvider, subject: string): Promise<IdentityRecord | null>;
  /** Returns false when a concurrent transaction already created this identity. */
  create(identity: NewIdentity): Promise<boolean>;
  recordUse(identityId: string, profile: IdentityProfile, now: Date): Promise<void>;
  listForUser(userId: string): Promise<IdentityRecord[]>;
}

export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');
