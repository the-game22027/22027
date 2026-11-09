import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../http/public.decorator';
import { MetricsService } from './metrics.service';

/** Prometheus scrape endpoint. Must only be reachable from the internal network in deployments. */
@Public()
@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res() res: Response): Promise<void> {
    res.type(this.metrics.registry.contentType).send(await this.metrics.registry.metrics());
  }
}
