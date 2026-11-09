import { Module } from '@nestjs/common';
import { ApplyProviderMatchUpdate } from './application/apply-provider-match-update';
import { FootballSyncService } from './application/football-sync.service';
import { FOOTBALL_DATA_PROVIDER } from './application/ports/football-data-provider';
import { FOOTBALL_REFERENCE_REPOSITORY } from './application/ports/football-reference-repository';
import { MATCH_WRITE_REPOSITORY } from './application/ports/match-write-repository';
import { MockFootballProvider } from './infrastructure/mock/mock-football-provider';
import { PrismaFootballReferenceRepository } from './infrastructure/prisma-football-reference.repository';
import { PrismaMatchWriteRepository } from './infrastructure/prisma-match-write.repository';

@Module({
  providers: [
    ApplyProviderMatchUpdate,
    FootballSyncService,
    { provide: MATCH_WRITE_REPOSITORY, useClass: PrismaMatchWriteRepository },
    { provide: FOOTBALL_REFERENCE_REPOSITORY, useClass: PrismaFootballReferenceRepository },
    { provide: FOOTBALL_DATA_PROVIDER, useClass: MockFootballProvider },
  ],
  exports: [ApplyProviderMatchUpdate, FootballSyncService],
})
export class FootballIngestionModule {}
