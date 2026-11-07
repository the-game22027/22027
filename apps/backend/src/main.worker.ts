import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttpApp } from './bootstrap/configure-http-app';
import { loadConfigOrExit } from './bootstrap/load-config';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const config = loadConfigOrExit();
  // The worker's HTTP server only exposes /health and /metrics for orchestration and scraping.
  const app = await NestFactory.create<NestExpressApplication>(WorkerModule.register(config), {
    bufferLogs: true,
    bodyParser: false,
  });
  configureHttpApp(app, { api: false });
  await app.listen(config.workerPort);
}

void bootstrap();
