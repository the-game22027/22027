import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept client-provided ids only if they are short and safe to log/echo.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

type RequestWithId = IncomingMessage & { id?: unknown };

/**
 * Resolves the request id once per request: a valid incoming `X-Request-Id` is reused, otherwise a
 * new one is generated. The id is stored on `req.id` and echoed in the response header, so the
 * logger (pino-http) and the request context (nestjs-cls) always agree, whichever runs first.
 */
export function resolveRequestId(req: IncomingMessage, res?: ServerResponse): string {
  const request = req as RequestWithId;
  if (typeof request.id === 'string' && request.id.length > 0) {
    return request.id;
  }
  const header = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;
  const id = candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
  request.id = id;
  if (res && !res.headersSent) {
    res.setHeader('X-Request-Id', id);
  }
  return id;
}
