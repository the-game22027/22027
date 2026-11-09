import { InvalidUsernameError } from './user-errors';

export function assertValidUsername(username: string, pattern: RegExp): void {
  if (!pattern.test(username)) throw new InvalidUsernameError();
}
