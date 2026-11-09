import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { UsersFacade } from '@modules/users';
import type { LocalizedRequest } from '@shared/infrastructure/http/request-locale.decorator';
import { localeFromHeader } from '@shared/kernel';
import type { AuthenticatedRequest } from './jwt-auth.guard';

// Lives in auth so that modules like football get the profile locale without depending on users.
@Injectable()
export class RequestLocaleInterceptor implements NestInterceptor {
  constructor(private readonly users: UsersFacade) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest & LocalizedRequest>();
      const fromHeader = localeFromHeader(request.headers['accept-language']);
      const locale = fromHeader ?? (request.auth && (await this.users.getAccount(request.auth.userId))?.locale);
      if (locale) request.locale = locale;
    }
    return next.handle();
  }
}
