import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type {
  IdentityProfile,
  IdentityRecord,
  IdentityRepository,
  NewIdentity,
} from '../application/ports/identity-repository';
import type { AuthProvider } from '../domain/auth-provider';

const RECORD = { id: true, userId: true, provider: true, email: true, displayName: true } as const;

@Injectable()
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  findBySubject(provider: AuthProvider, subject: string): Promise<IdentityRecord | null> {
    return this.txHost.tx.authIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject: subject } },
      select: RECORD,
    });
  }

  async create(identity: NewIdentity): Promise<boolean> {
    // ON CONFLICT DO NOTHING: a unique violation would abort the whole transaction instead.
    const { count } = await this.txHost.tx.authIdentity.createMany({
      data: {
        id: identity.id,
        userId: identity.userId,
        provider: identity.provider,
        providerSubject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: identity.displayName,
        createdAt: identity.now,
        lastUsedAt: identity.now,
      },
      skipDuplicates: true,
    });
    return count === 1;
  }

  async recordUse(identityId: string, profile: IdentityProfile, now: Date): Promise<void> {
    await this.txHost.tx.authIdentity.update({
      where: { id: identityId },
      data: { ...profile, lastUsedAt: now },
    });
  }

  listForUser(userId: string): Promise<IdentityRecord[]> {
    return this.txHost.tx.authIdentity.findMany({ where: { userId }, select: RECORD, orderBy: { createdAt: 'asc' } });
  }
}
