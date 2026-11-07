import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client';
import { AppConfig } from '../config';

/**
 * The single PrismaClient of the process (Prisma 7 + `pg` driver adapter). Repositories should not
 * use it directly for writes inside use cases: inject `TransactionHost` so they join the current
 * transaction (@nestjs-cls/transactional).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
