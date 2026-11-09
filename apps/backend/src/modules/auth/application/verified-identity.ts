import type { AuthProvider } from '../domain/auth-provider';

export interface VerifiedIdentity {
  readonly provider: AuthProvider;
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName?: string;
  readonly avatarUrl?: string;
}
