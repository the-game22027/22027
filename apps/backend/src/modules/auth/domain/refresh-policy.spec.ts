import { absoluteExpiry, assessRefresh, type SessionState, slidingExpiry } from './refresh-policy';

const now = new Date('2026-11-08T12:00:00Z');
const active: SessionState = {
  revokedAt: null,
  replacedBySessionId: null,
  expiresAt: new Date('2026-12-01T00:00:00Z'),
  absoluteExpiresAt: new Date('2027-03-01T00:00:00Z'),
};

describe('assessRefresh', () => {
  it('accepts a live, unrevoked session', () => {
    expect(assessRefresh(active, now)).toBe('ACTIVE');
  });

  it('flags a rotated token presented again as reuse', () => {
    expect(assessRefresh({ ...active, revokedAt: now, replacedBySessionId: 's2' }, now)).toBe('REUSED');
  });

  it('treats a session revoked for any other reason as revoked, not reused', () => {
    expect(assessRefresh({ ...active, revokedAt: now }, now)).toBe('REVOKED');
  });

  it('expires at the sliding or the absolute limit, whichever comes first', () => {
    expect(assessRefresh({ ...active, expiresAt: now }, now)).toBe('EXPIRED');
    expect(assessRefresh({ ...active, absoluteExpiresAt: now }, now)).toBe('EXPIRED');
  });
});

describe('expiry', () => {
  it('slides forward but never past the absolute limit', () => {
    const farLimit = absoluteExpiry(now, 180);
    expect(slidingExpiry(now, 60, farLimit).toISOString()).toBe('2027-01-07T12:00:00.000Z');
    const nearLimit = new Date('2026-11-20T00:00:00Z');
    expect(slidingExpiry(now, 60, nearLimit)).toEqual(nearLimit);
  });
});
