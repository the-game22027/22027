import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from '@shared/infrastructure/config';
import { httpMetricsMiddleware } from '@shared/infrastructure/metrics/http-metrics.middleware';
import { MetricsService } from '@shared/infrastructure/metrics/metrics.service';
import { OutboxSubscriptionRegistry } from '@shared/infrastructure/outbox';
import { QueueProvider } from '@shared/infrastructure/queue/queue-provider';

export interface HttpAppOptions {
  /** API process only: Swagger UI, Bull Board and the Socket.IO adapter. */
  api: boolean;
}

/**
 * HTTP setup shared by both entry points and the e2e tests, so tests exercise exactly what runs.
 * Expects the app to be created with `{ bodyParser: false, bufferLogs: true }`.
 */
export function configureHttpApp(app: NestExpressApplication, options: HttpAppOptions): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.set('trust proxy', config.trustProxyHops);
  // The API serves JSON only; CSP is relaxed in development so Swagger UI can load.
  app.use(helmet({ contentSecurityPolicy: config.devToolsEnabled ? false : undefined }));
  app.use(httpMetricsMiddleware(app.get(MetricsService)));
  app.useBodyParser('json', { limit: config.httpBodyLimit });
  app.enableVersioning({ type: VersioningType.URI });

  if (!options.api) return;

  app.useWebSocketAdapter(new IoAdapter(app));
  if (config.devToolsEnabled) {
    mountSwagger(app);
    mountBullBoard(app);
  }
}

function mountSwagger(app: NestExpressApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('the-game API')
      .setDescription('Design source: docs/api/API.md. Errors are RFC 9457 problem+json.')
      .setVersion('1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}

function mountBullBoard(app: NestExpressApplication): void {
  const queues = app.get(QueueProvider);
  const serverAdapter = new ExpressAdapter().setBasePath('/admin/queues');
  createBullBoard({
    queues: app
      .get(OutboxSubscriptionRegistry)
      .queueNames()
      .map((name) => new BullMQAdapter(queues.get(name))),
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());
}
