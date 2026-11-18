import { Inject, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import { AppConfig, type PerUserRateLimitName } from '../config';

const PER_USER_RATE_LIMIT = 'per-user-rate-limit';

/** Limits this route per signed-in user, with the limit and window from config (API.md §7). */
export const RateLimitPerUser = (name: PerUserRateLimitName) => SetMetadata(PER_USER_RATE_LIMIT, name);

/**
 * One bucket per user and route group (`rl:<name>:<userId>`), shared by every API instance. Routes
 * without `@RateLimitPerUser` pass through. Runs after the JWT guard, which sets `request.auth`.
 */
@Injectable()
export class PerUserRateLimitGuard extends ThrottlerGuard {
  @Inject(AppConfig) private readonly config!: AppConfig;

  protected override handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const name = this.reflector.get<PerUserRateLimitName | undefined>(
      PER_USER_RATE_LIMIT,
      requestProps.context.getHandler(),
    );
    if (!name) return Promise.resolve(true);
    const { limit, windowMs } = this.config.rateLimit.perUser[name];
    return super.handleRequest({
      ...requestProps,
      limit,
      ttl: windowMs,
      blockDuration: windowMs,
      getTracker: (request: Record<string, unknown>) =>
        Promise.resolve((request['auth'] as { userId?: string } | undefined)?.userId ?? String(request['ip'])),
      generateKey: (_context, tracker) => `rl:${name}:${tracker}`,
    });
  }
}
