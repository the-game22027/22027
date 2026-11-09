import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_LOCALE, type Locale } from '@shared/kernel';

export interface LocalizedRequest extends Request {
  locale?: Locale;
}

export const RequestLocale = createParamDecorator(
  (_: unknown, context: ExecutionContext): Locale =>
    context.switchToHttp().getRequest<LocalizedRequest>().locale ?? DEFAULT_LOCALE,
);
