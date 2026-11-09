import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { Prisma } from '@generated/prisma/client';
import type { NewSession, SessionRecord, SessionRepository } from '../application/ports/session-repository';
import type { RevokeReason } from '../domain/refresh-policy';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async create(session: NewSession): Promise<void> {
    await this.txHost.tx.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        familyId: session.familyId,
        refreshTokenHash: session.refreshTokenHash,
        platform: session.device.platform ?? null,
        deviceName: session.device.deviceName ?? null,
        userAgent: session.device.userAgent ?? null,
        createdIp: session.device.ip ?? null,
        createdAt: session.now,
        lastUsedAt: session.now,
        expiresAt: session.expiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
      },
    });
  }

  async findByTokenHashForUpdate(hash: Uint8Array<ArrayBuffer>): Promise<SessionRecord | null> {
    // Raw SQL because Prisma's query API has no FOR UPDATE.
    const rows = await this.txHost.tx.$queryRaw<SessionRecord[]>`
      SELECT id::text, user_id::text AS "userId", family_id::text AS "familyId", platform, device_name AS "deviceName",
             replaced_by_session_id::text AS "replacedBySessionId", revoked_at AS "revokedAt",
             expires_at AS "expiresAt", absolute_expires_at AS "absoluteExpiresAt"
      FROM sessions
      WHERE refresh_token_hash = ${Buffer.from(hash)}
      FOR UPDATE`;
    return rows[0] ?? null;
  }

  async markRotated(sessionId: string, replacedBySessionId: string, now: Date): Promise<void> {
    await this.txHost.tx.session.update({
      where: { id: sessionId },
      data: { replacedBySessionId, revokedAt: now, revokeReason: 'ROTATED', lastUsedAt: now },
    });
  }

  async revokeFamily(familyId: string, reason: RevokeReason, now: Date): Promise<void> {
    await this.lockThenRevoke(Prisma.sql`family_id = ${familyId}::uuid`, { familyId }, reason, now);
  }

  // A refresh in flight holds a row lock while inserting the replacement session, which a single UPDATE
  // would not see. Waiting for those locks first means the UPDATE, a new statement, sees the committed row.
  private async lockThenRevoke(
    lockWhere: Prisma.Sql,
    where: Prisma.SessionWhereInput,
    reason: RevokeReason,
    now: Date,
  ): Promise<void> {
    await this.txHost.tx.$queryRaw`SELECT id::text FROM sessions WHERE ${lockWhere} ORDER BY id FOR UPDATE`;
    await this.txHost.tx.session.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
  }
}
