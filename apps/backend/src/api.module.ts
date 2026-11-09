import { type DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth';
import type { AppConfig } from '@shared/infrastructure/config';
import { CoreModule } from '@shared/infrastructure/core.module';
import { DevModule } from '@shared/infrastructure/dev/dev.module';

/**
 * Root module of the API process (HTTP + WebSocket). Business modules are added here as phases land
 * (docs/ROADMAP.md); their `*JobsModule` processors go to WorkerModule instead.
 */
@Module({})
export class ApiModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: ApiModule,
      imports: [CoreModule.register(config), AuthModule, ...(config.devToolsEnabled ? [DevModule] : [])],
    };
  }
}
