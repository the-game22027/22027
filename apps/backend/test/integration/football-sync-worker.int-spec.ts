import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { WorkerModule } from '../../src/worker.module';
import { testConfig } from '../support/test-app';

describe('football sync in the worker', () => {
  let moduleRef: TestingModule;

  afterAll(() => moduleRef.close());

  it('runs the sync on its schedule', async () => {
    const startedAt = new Date();
    moduleRef = await Test.createTestingModule({
      imports: [WorkerModule.register(testConfig({ FOOTBALL_SYNC_INTERVAL_SECONDS: '1' }))],
    }).compile();
    await moduleRef.init();
    const prisma = moduleRef.get(PrismaService);

    const finished = async () =>
      prisma.providerSyncRun.findFirst({ where: { startedAt: { gte: startedAt }, status: 'SUCCEEDED' } });
    let run = await finished();
    for (let waited = 0; !run && waited < 45_000; waited += 250) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      run = await finished();
    }

    expect(run).toMatchObject({ provider: 'mock', status: 'SUCCEEDED' });
  }, 60_000);
});
