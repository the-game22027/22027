import { DomainError } from '@shared/kernel';

export class MatchNotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor() {
    super('Match not found.');
  }
}

export class SimulationRejectedError extends DomainError {
  readonly code = 'SIMULATION_REJECTED';
  readonly kind = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}
