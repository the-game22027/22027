import { Module } from '@nestjs/common';
import { ApplyProviderMatchUpdate } from './application/apply-provider-match-update';
import { MATCH_WRITE_REPOSITORY } from './application/ports/match-write-repository';
import { PrismaMatchWriteRepository } from './infrastructure/prisma-match-write.repository';

@Module({
  providers: [ApplyProviderMatchUpdate, { provide: MATCH_WRITE_REPOSITORY, useClass: PrismaMatchWriteRepository }],
  exports: [ApplyProviderMatchUpdate],
})
export class FootballJobsModule {}
