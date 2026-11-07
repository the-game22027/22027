import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, type HealthCheckResult, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../persistence';
import { RedisHealthIndicator } from './redis.health';

/** Liveness = the process is up. Readiness = it can serve traffic (database and Redis reachable). */
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
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma).withTimeout(1500),
      () => this.redisIndicator.ping('redis'),
    ]);
  }
}
