import { DomainError } from '@shared/kernel';

export class PeriodNotFoundError extends DomainError {
  readonly code = 'PERIOD_NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor(kind: string, key: string) {
    super(`There is no ${kind} leaderboard period "${key}".`);
  }
}
