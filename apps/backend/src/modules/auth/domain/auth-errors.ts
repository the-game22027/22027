import { DomainError } from '@shared/kernel';

export class InvalidAccessTokenError extends DomainError {
  readonly code = 'UNAUTHENTICATED';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('The access token is missing or invalid.');
  }
}

export class AccessTokenExpiredError extends DomainError {
  readonly code = 'TOKEN_EXPIRED';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('The access token has expired.');
  }
}
