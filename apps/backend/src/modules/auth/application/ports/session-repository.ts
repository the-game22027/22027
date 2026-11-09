import type { RevokeReason, SessionState } from '../../domain/refresh-policy';

export interface SessionRecord extends SessionState {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly platform: string | null;
  readonly deviceName: string | null;
}

export interface DeviceInfo {
  readonly platform?: string;
  readonly deviceName?: string;
  readonly userAgent?: string;
  readonly ip?: string;
}

export interface NewSession {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly refreshTokenHash: Uint8Array<ArrayBuffer>;
  readonly device: DeviceInfo;
  readonly now: Date;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface ActiveSession {
  readonly id: string;
  readonly familyId: string;
  readonly platform: string | null;
  readonly deviceName: string | null;
  readonly signedInAt: Date;
  readonly lastUsedAt: Date;
}

export interface SessionFamilyState {
  readonly familyId: string;
  readonly userId: string;
  readonly signedInAt: Date;
  readonly active: boolean;
}

export interface SessionRepository {
  create(session: NewSession): Promise<void>;
  /** Locks the row until the transaction ends, so the same token cannot be rotated twice. */
  findByTokenHashForUpdate(hash: Uint8Array<ArrayBuffer>): Promise<SessionRecord | null>;
  markRotated(sessionId: string, replacedBySessionId: string, now: Date): Promise<void>;
  revokeFamily(familyId: string, reason: RevokeReason, now: Date): Promise<void>;
  revokeAllForUser(userId: string, reason: RevokeReason, now: Date): Promise<void>;
  findFamilyState(sessionId: string, now: Date): Promise<SessionFamilyState | null>;
  findOwned(sessionId: string, userId: string): Promise<{ familyId: string } | null>;
  findActiveForUser(userId: string, now: Date): Promise<ActiveSession[]>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
