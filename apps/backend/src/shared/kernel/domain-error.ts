/**
 * Category of a domain error. The presentation layer maps it to a transport status
 * (HTTP in problem-details.filter.ts, WebSocket ack codes later). Domain code never knows HTTP.
 */
export type DomainErrorKind =
  | 'VALIDATION' // input violates a business invariant
  | 'UNAUTHENTICATED' // identity could not be established (e.g. reused refresh token)
  | 'NOT_FOUND' // missing or not visible to the caller
  | 'CONFLICT' // state does not allow the action (locked, closed, duplicate)
  | 'FORBIDDEN' // caller is known but not allowed
  | 'UNPROCESSABLE' // well-formed but semantically invalid for the current rules
  | 'PRECONDITION_FAILED' // optimistic concurrency check failed (If-Match)
  | 'RATE_LIMITED';

/**
 * Base class for expected business failures. `code` is the stable machine contract
 * (docs/api/API.md §4): clients localize messages from it, so never change an existing code.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  protected constructor(
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
