import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { Prisma } from '@generated/prisma/client';
import type { UserRepository } from '../application/ports/user-repository';
import type { NewUser, ProfilePatch, UserAccount } from '../application/user-account';
import { UsernameTakenError } from '../domain/user-errors';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async create(user: NewUser): Promise<void> {
    await this.txHost.tx.user.create({
      data: {
        id: user.id,
        profile: { create: { displayName: user.displayName, avatarUrl: user.avatarUrl } },
        privacySettings: { create: {} },
      },
    });
  }

  async findAccount(userId: string): Promise<UserAccount | null> {
    const user = await this.txHost.tx.user.findUnique({
      where: { id: userId },
      include: { profile: true, privacySettings: true },
    });
    if (!user?.profile) return null;
    return {
      id: user.id,
      status: user.status,
      displayName: user.profile.displayName,
      username: user.profile.username,
      avatarUrl: user.profile.avatarUrl,
      locale: user.profile.locale,
      predictionVisibility: user.privacySettings?.predictionVisibility ?? null,
    };
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    try {
      await this.txHost.tx.userProfile.update({ where: { userId }, data: patch });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UsernameTakenError();
      }
      throw error;
    }
  }
}
