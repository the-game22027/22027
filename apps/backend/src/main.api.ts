import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiModule } from './api.module';
import { configureHttpApp } from './bootstrap/configure-http-app';
import { loadConfigOrExit } from './bootstrap/load-config';

async function bootstrap(): Promise<void> {
  const config = loadConfigOrExit();
  const app = await NestFactory.create<NestExpressApplication>(ApiModule.register(config), {
    bufferLogs: true,
    bodyParser: false,
  });
  configureHttpApp(app, { api: true });
  await app.listen(config.apiPort);
}

void bootstrap();
