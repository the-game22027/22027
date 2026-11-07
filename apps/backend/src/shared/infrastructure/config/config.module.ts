import { type DynamicModule, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

/**
 * Provides the already-validated `AppConfig` everywhere. Entry points validate the environment
 * before Nest starts (bootstrap/load-config.ts); tests build their own `AppConfig` with `loadConfig`.
 */
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: AppConfig, useValue: config }],
      exports: [AppConfig],
    };
  }
}
