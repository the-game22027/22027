import { type DynamicModule, Module } from '@nestjs/common';
import { BattlesCliModule } from '@modules/battles';
import { FootballSimulatorModule } from '@modules/football';
import { QuestionBankCliModule } from '@modules/question-bank';
import { AppConfig } from '@shared/infrastructure/config';
import { CoreModule } from '@shared/infrastructure/core.module';

@Module({})
export class CliModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: CliModule,
      imports: [
        CoreModule.register(config),
        QuestionBankCliModule,
        BattlesCliModule,
        ...(config.devToolsEnabled ? [FootballSimulatorModule] : []),
      ],
    };
  }
}
