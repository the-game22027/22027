import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** One bucket per IP across all of `POST /auth/*` (API.md §7), so an attacker cannot spread over routes. */
@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected override generateKey(_context: unknown, tracker: string): string {
    return `rl:auth:${tracker}`;
  }
}
