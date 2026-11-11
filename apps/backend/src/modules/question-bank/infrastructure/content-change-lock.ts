import type { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';

type Transaction = TransactionHost<TransactionalAdapterPrisma<PrismaService>>['tx'];

/**
 * One lock for every change to content: imports, publishing, disabling. Held until the transaction ends,
 * so an import never decides "never published, replace in place" while a publish is committing.
 */
export async function takeContentChangeLock(tx: Transaction): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('question-bank:import'))`;
}
