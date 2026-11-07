import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config';
import { buildPinoHttpOptions } from './logger-options';

/** Structured JSON logs (pretty-printed only in development). Use Nest's `Logger` in code. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ pinoHttp: buildPinoHttpOptions(config) }),
    }),
  ],
})
export class LoggingModule {}
