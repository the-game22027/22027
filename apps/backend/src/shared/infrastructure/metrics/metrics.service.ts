import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from '@prometheus-io/client';

/** One Prometheus registry per process. Modules register their own metrics on `registry`. */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly outboxPublished = new Counter({
    name: 'outbox_events_published_total',
    help: 'Outbox events published to their subscriber queues',
    registers: [this.registry],
  });

  readonly outboxPublishFailures = new Counter({
    name: 'outbox_publish_failures_total',
    help: 'Outbox events that failed to publish and will be retried',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
