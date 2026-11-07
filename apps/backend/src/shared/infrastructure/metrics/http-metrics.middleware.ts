import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from './metrics.service';

/** Records every HTTP request, labelled by route pattern (not raw URL) to keep cardinality bounded. */
export function httpMetricsMiddleware(metrics: MetricsService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const stopTimer = metrics.httpRequestDuration.startTimer();
    res.on('finish', () => {
      const routePath = (req.route as { path?: string } | undefined)?.path;
      const route = routePath === undefined ? 'unmatched' : `${req.baseUrl}${routePath}`;
      stopTimer({ method: req.method, route, status_code: String(res.statusCode) });
    });
    next();
  };
}
