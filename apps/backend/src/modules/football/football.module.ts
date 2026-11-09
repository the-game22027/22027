import { Module } from '@nestjs/common';
import { FootballQuery } from './application/football.query';
import { FOOTBALL_READ_REPOSITORY } from './application/ports/football-read-repository';
import { PrismaFootballReadRepository } from './infrastructure/prisma-football-read.repository';
import { FootballController } from './presentation/football.controller';

@Module({
  controllers: [FootballController],
  providers: [FootballQuery, { provide: FOOTBALL_READ_REPOSITORY, useClass: PrismaFootballReadRepository }],
  exports: [FootballQuery],
})
export class FootballModule {}
