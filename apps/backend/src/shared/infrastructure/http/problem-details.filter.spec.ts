import { type ArgumentsHost, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { DomainError } from '@shared/kernel';
import type { ProblemDetails } from './problem-details';
import { ProblemDetailsFilter } from './problem-details.filter';
import { RequestValidationException } from './request-validation';

class PredictionLockedError extends DomainError {
  readonly code = 'PREDICTION_LOCKED';
  readonly kind = 'CONFLICT';
  constructor() {
    super('Predictions for this match closed at kickoff.');
  }
}

class InvalidPicksError extends DomainError {
  readonly code = 'PREDICTION_INVALID_PICKS';
  readonly kind = 'UNPROCESSABLE';
  constructor() {
    super('Picks violate the active prediction config.');
  }
}

interface Captured {
  status?: number;
  contentType?: string;
  body?: ProblemDetails;
}

function render(exception: unknown): Captured {
  const captured: Captured = {};
  const response = {
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    type(value: string) {
      captured.contentType = value;
      return this;
    },
    json(body: ProblemDetails) {
      captured.body = body;
      return this;
    },
  };
  const request = { originalUrl: '/v1/matches/123/prediction?x=1', headers: {} };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const cls = { isActive: () => true, getId: () => 'trace-abc' } as unknown as ClsService;

  new ProblemDetailsFilter(cls).catch(exception, host);
  return captured;
}

describe('ProblemDetailsFilter', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('maps a domain error by kind, keeping its stable code', () => {
    const { status, contentType, body } = render(new PredictionLockedError());
    expect(status).toBe(409);
    expect(contentType).toBe('application/problem+json');
    expect(body).toEqual({
      type: '/errors/PREDICTION_LOCKED',
      title: 'Prediction locked',
      status: 409,
      code: 'PREDICTION_LOCKED',
      detail: 'Predictions for this match closed at kickoff.',
      instance: '/v1/matches/123/prediction',
      traceId: 'trace-abc',
    });
  });

  it('maps UNPROCESSABLE domain errors to 422', () => {
    expect(render(new InvalidPicksError()).status).toBe(422);
  });

  it('renders validation errors as 400 VALIDATION_FAILED with errors[]', () => {
    const errors = [{ field: 'picks[1].homeScore', code: 'min', message: 'must be >= 0' }];
    const { status, body } = render(new RequestValidationException(errors));
    expect(status).toBe(400);
    expect(body?.code).toBe('VALIDATION_FAILED');
    expect(body?.errors).toEqual(errors);
  });

  it('keeps framework HTTP statuses with a stable code', () => {
    expect(render(new NotFoundException()).body?.code).toBe('NOT_FOUND');
    expect(render(new PayloadTooLargeException()).body?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('turns unknown errors into 500 INTERNAL without leaking internals', () => {
    const { status, body } = render(new Error('connection string postgres://secret@db'));
    expect(status).toBe(500);
    expect(body?.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(body?.traceId).toBe('trace-abc');
  });
});
