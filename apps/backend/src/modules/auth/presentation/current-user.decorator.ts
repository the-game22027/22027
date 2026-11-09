import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../application/ports/access-tokens';
import { InvalidAccessTokenError } from '../domain/auth-errors';
import type { AuthenticatedRequest } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthContext => {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!auth) throw new InvalidAccessTokenError();
  return auth;
});
