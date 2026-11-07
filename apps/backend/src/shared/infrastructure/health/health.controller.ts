import { Controller, Get, Res, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { type HealthCheckResult, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../persistence';
import { RedisHealthIndicator } from './redis.health';

/**
 * Liveness = the process is up. Readiness = it can serve traffic (database and Redis reachable).
 * A failing check returns 503 with Terminus' per-dependency details (not problem+json): probes only
 * need the status, and operators need to see which dependency is down.
 */
@ApiTags('ops')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  live(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResult> {
    return this.respond(res, this.health.check([]));
  }

  @Get('ready')
  ready(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResult> {
    return this.respond(
      res,
      this.health.check([
        () => this.prismaIndicator.pingCheck('database', this.prisma).withTimeout(1500),
        () => this.redisIndicator.ping('redis'),
      ]),
    );
  }

  private async respond(res: Response, check: Promise<HealthCheckResult>): Promise<HealthCheckResult> {
    try {
      return await check;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        res.status(503);
        return error.getResponse() as HealthCheckResult;
      }
      throw error;
    }
  }
}
