import { DomainError } from '@shared/kernel';

/** Missing, malformed, forged or otherwise unusable access token (docs/api/API.md §4). */
export class InvalidAccessTokenError extends DomainError {
  readonly code = 'UNAUTHENTICATED';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('The access token is missing or invalid.');
  }
}

/** A genuine access token past its `exp`: the client should refresh and retry. */
export class AccessTokenExpiredError extends DomainError {
  readonly code = 'TOKEN_EXPIRED';
  readonly kind = 'UNAUTHENTICATED';

  constructor() {
    super('The access token has expired.');
  }
}
