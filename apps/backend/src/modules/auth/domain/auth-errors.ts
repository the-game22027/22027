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

export class ProviderTokenInvalidError extends DomainError {
  readonly code = 'PROVIDER_TOKEN_INVALID';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('The sign-in token from the identity provider is invalid or expired.');
  }
}

export class AccountDisabledError extends DomainError {
  readonly code = 'ACCOUNT_DISABLED';
  readonly kind = 'FORBIDDEN';

  constructor() {
    super('This account cannot sign in.');
  }
}

export class RefreshTokenInvalidError extends DomainError {
  readonly code = 'REFRESH_TOKEN_INVALID';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('The refresh token is unknown, expired or revoked. Sign in again.');
  }
}

export class RefreshTokenReusedError extends DomainError {
  readonly code = 'REFRESH_TOKEN_REUSED';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('This refresh token was already used. All sessions from this sign-in were revoked.');
  }
}
