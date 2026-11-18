import { type DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth';
import { PointsModule } from '@modules/points';
import { SocialModule } from '@modules/social';
import { QuestionBankModule } from '@modules/question-bank';
import { UsersModule } from '@modules/users';
import { AppConfig } from '@shared/infrastructure/config';
import { BattleEngine } from './application/battle-engine';
import { BATTLE_SETTINGS } from './application/battle-settings';
import { MatchmakingService } from './application/matchmaking.service';
import { ReportServedQuestion } from './application/report-served-question';
import { ACTIVITY_GUARD } from './application/ports/activity-guard';
import { BATTLE_NOTIFIER } from './application/ports/battle-notifier';
import { BATTLE_REPOSITORY } from './application/ports/battle-repository';
import { MATCHMAKING_QUEUE } from './application/ports/matchmaking-queue';
import { TIMER_SCHEDULER } from './application/ports/timer-scheduler';
import { loadBattleSettingsFile } from './infrastructure/battle-settings-file';
import { PrismaBattleRepository } from './infrastructure/prisma-battle.repository';
import { RedisActivityGuard } from './infrastructure/redis-activity-guard';
import { RedisMatchmakingQueue } from './infrastructure/redis-matchmaking-queue';
import { SystemTimerScheduler } from './infrastructure/system-timer-scheduler';
import { BattlesController } from './presentation/battles.controller';
import { BattlesGateway } from './presentation/battles.gateway';
import { QuestionReportsController } from './presentation/question-reports.controller';
import { SocketBattleNotifier } from './presentation/socket-battle-notifier';

/** Real-time battles (01 §2.8). API process only: the engine keeps live battles in memory. */
@Module({})
export class BattlesModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: BattlesModule,
      imports: [AuthModule.register(config), PointsModule, QuestionBankModule, SocialModule, UsersModule],
      controllers: [BattlesController, QuestionReportsController],
      providers: [
        BattleEngine,
        MatchmakingService,
        ReportServedQuestion,
        BattlesGateway,
        SocketBattleNotifier,
        {
          provide: BATTLE_SETTINGS,
          inject: [AppConfig],
          useFactory: (appConfig: AppConfig) =>
            loadBattleSettingsFile(appConfig.battleConfigPath, appConfig.isProduction),
        },
        { provide: BATTLE_NOTIFIER, useExisting: SocketBattleNotifier },
        { provide: BATTLE_REPOSITORY, useClass: PrismaBattleRepository },
        { provide: ACTIVITY_GUARD, useClass: RedisActivityGuard },
        { provide: MATCHMAKING_QUEUE, useClass: RedisMatchmakingQueue },
        { provide: TIMER_SCHEDULER, useClass: SystemTimerScheduler },
      ],
    };
  }
}
