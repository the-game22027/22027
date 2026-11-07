import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
class PrismaModule {}

/**
 * Prisma + declarative transactions. Use `@Transactional()` on use cases, or
 * `TransactionHost#withTransaction`; repositories use `txHost.tx` so they share the transaction.
 */
@Module({
  imports: [
    PrismaModule,
    ClsModule.forFeature(),
    ClsModule.registerPlugins([
      new ClsPluginTransactional({
        imports: [PrismaModule],
        adapter: new TransactionalAdapterPrisma<PrismaService>({
          prismaInjectionToken: PrismaService,
          sqlFlavor: 'postgresql',
        }),
      }),
    ]),
  ],
  exports: [PrismaModule],
})
export class PersistenceModule {}
