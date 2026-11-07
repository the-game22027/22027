import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import type { FieldError } from './problem-details';

/** Thrown by the global ValidationPipe; rendered as `400 VALIDATION_FAILED` with `errors[]`. */
export class RequestValidationException extends BadRequestException {
  constructor(readonly fieldErrors: FieldError[]) {
    super('Request validation failed');
  }
}

/** Flattens class-validator's tree into `picks[1].homeScore`-style field paths. */
export function flattenValidationErrors(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const segment = /^\d+$/.test(error.property) ? `[${error.property}]` : error.property;
    const path = parentPath === '' ? segment : segment.startsWith('[') ? `${parentPath}${segment}` : `${parentPath}.${segment}`;
    const own = Object.entries(error.constraints ?? {}).map(([code, message]) => ({ field: path, code, message }));
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new RequestValidationException(flattenValidationErrors(errors)),
  });
}
