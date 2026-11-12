import type { DomainErrorKind } from '@shared/kernel';

/** RFC 9457 body returned for every error (docs/api/API.md §4). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance: string;
  traceId: string;
  errors?: FieldError[];
  /** RFC 9457 extension members from a domain error's `details`, e.g. `requestId`. */
  [extension: string]: unknown;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export const PROBLEM_JSON = 'application/problem+json';

export const STATUS_BY_KIND: Readonly<Record<DomainErrorKind, number>> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
};

/** Codes for errors raised by the framework itself (routing, body parsing, guards). */
const CODE_BY_HTTP_STATUS: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

export function codeForHttpStatus(status: number): string {
  if (status >= 500) return 'INTERNAL';
  return CODE_BY_HTTP_STATUS[status] ?? `HTTP_${status}`;
}

/** "PREDICTION_LOCKED" → "Prediction locked". Clients localize from `code`; titles are for developers. */
export function titleFromCode(code: string): string {
  const words = code.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
