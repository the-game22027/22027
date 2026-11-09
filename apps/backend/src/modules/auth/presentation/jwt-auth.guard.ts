import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from '@shared/infrastructure/http/public.decorator';
import { ACCESS_TOKENS, type AccessTokens, type AuthContext } from '../application/ports/access-tokens';
import { InvalidAccessTokenError } from '../domain/auth-errors';

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKENS) private readonly tokens: AccessTokens,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.auth = await this.tokens.verify(bearerToken(request));
    return true;
  }
}

function bearerToken(request: Request): string {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw new InvalidAccessTokenError();
  return token;
}
