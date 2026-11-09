import { isRecentSignIn } from './recent-sign-in';

describe('isRecentSignIn', () => {
  const signedInAt = new Date('2026-11-09T12:00:00Z');
  const fiveMinutesLater = new Date('2026-11-09T12:05:00Z');

  it('follows the configured window', () => {
    expect(isRecentSignIn(signedInAt, fiveMinutesLater, 600)).toBe(true);
    expect(isRecentSignIn(signedInAt, fiveMinutesLater, 60)).toBe(false);
  });

  it('includes the exact end of the window', () => {
    expect(isRecentSignIn(signedInAt, fiveMinutesLater, 300)).toBe(true);
  });
});
