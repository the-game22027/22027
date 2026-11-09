import { DomainError } from '@shared/kernel';

export class InvalidDisplayNameError extends DomainError {
  readonly code = 'DISPLAY_NAME_INVALID';
  readonly kind = 'VALIDATION';

  constructor() {
    super('The display name is blank or too long.');
  }
}

export class InvalidUsernameError extends DomainError {
  readonly code = 'USERNAME_INVALID';
  readonly kind = 'VALIDATION';

  constructor() {
    super('The username has an invalid format.');
  }
}

export class UsernameTakenError extends DomainError {
  readonly code = 'USERNAME_TAKEN';
  readonly kind = 'CONFLICT';

  constructor() {
    super('This username is already taken.');
  }
}
