import { InvalidUsernameError } from './user-errors';
import { assertValidUsername } from './username';

describe('assertValidUsername', () => {
  it('follows the configured pattern', () => {
    expect(() => assertValidUsername('mo_salah', /^[a-z_]{3,20}$/)).not.toThrow();
    expect(() => assertValidUsername('mo_salah', /^[a-z]{3,20}$/)).toThrow(InvalidUsernameError);
  });
});
