import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { DomainError } from '@shared/kernel';
import { resolveRequestId } from '../request-context/request-id';
import { codeForHttpStatus, PROBLEM_JSON, type ProblemDetails, STATUS_BY_KIND, titleFromCode } from './problem-details';
import { RequestValidationException } from './request-validation';

/**
 * The only place errors become HTTP responses. Domain errors map by `kind`, validation errors carry
 * `errors[]`, framework HttpExceptions keep their status, and anything unexpected is a 500 `INTERNAL`
 * without internals (logged in full with the trace id).
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception; // WebSocket errors are handled by gateways (api/WEBSOCKET.md)
    }
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const traceId = this.traceId(request);
    const problem = this.toProblem(exception, request, traceId);

    if (problem.status >= 500) {
      this.logger.error({ err: exception, traceId }, 'Unhandled error');
    }
    if (response.headersSent) {
      return;
    }
    response.status(problem.status).type(PROBLEM_JSON).json(problem);
  }

  private toProblem(exception: unknown, request: Request, traceId: string): ProblemDetails {
    const instance = request.originalUrl.split('?')[0] ?? request.originalUrl;

    if (exception instanceof DomainError) {
      // Details become RFC 9457 extension members; the standard members always win over them.
      return {
        ...exception.details,
        ...this.build(STATUS_BY_KIND[exception.kind], exception.code, instance, traceId, exception.message),
      };
    }
    if (exception instanceof RequestValidationException) {
      return {
        ...this.build(400, 'VALIDATION_FAILED', instance, traceId, 'One or more fields are invalid.'),
        errors: exception.fieldErrors,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const detail = status >= 500 ? undefined : exception.message;
      return this.build(status, codeForHttpStatus(status), instance, traceId, detail);
    }
    if (isBodyParserError(exception)) {
      return this.build(exception.status, codeForHttpStatus(exception.status), instance, traceId, exception.message);
    }
    return this.build(500, 'INTERNAL', instance, traceId, 'An unexpected error occurred.');
  }

  private build(status: number, code: string, instance: string, traceId: string, detail?: string): ProblemDetails {
    return {
      type: `/errors/${code}`,
      title: titleFromCode(code),
      status,
      code,
      ...(detail === undefined ? {} : { detail }),
      instance,
      traceId,
    };
  }

  private traceId(request: Request): string {
    return this.cls.isActive() ? this.cls.getId() : resolveRequestId(request);
  }
}

/** Errors from Express body parsing (malformed JSON, body too large) carry a 4xx `status` and `type`. */
function isBodyParserError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500 &&
    'type' in error
  );
}
