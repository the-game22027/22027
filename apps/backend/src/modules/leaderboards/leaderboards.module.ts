import { Module } from '@nestjs/common';
import { UsersModule } from '@modules/users';
import { LeaderboardQuery } from './application/leaderboard.query';
import { LEADERBOARD_REPOSITORY } from './application/ports/leaderboard-repository';
import { PrismaLeaderboardRepository } from './infrastructure/prisma-leaderboard.repository';
import { leaderboardCalendarProvider } from './leaderboard-calendar.provider';
import { LeaderboardsController } from './presentation/leaderboards.controller';

/** Board reads over HTTP (01 §2.10). The projection lives in LeaderboardsJobsModule. */
@Module({
  imports: [UsersModule],
  controllers: [LeaderboardsController],
  providers: [
    LeaderboardQuery,
    leaderboardCalendarProvider,
    { provide: LEADERBOARD_REPOSITORY, useClass: PrismaLeaderboardRepository },
  ],
  exports: [LeaderboardQuery],
})
export class LeaderboardsModule {}
