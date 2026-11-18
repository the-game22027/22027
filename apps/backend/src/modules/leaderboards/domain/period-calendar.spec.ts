import {
  findPeriodByKey,
  findPeriodContaining,
  findPeriodStatus,
  type LeaderboardCalendar,
  listPeriodsBetween,
  listRecentPeriods,
  type Weekday,
} from './period-calendar';

const cairo = (weekStartsOn: Weekday = 'MONDAY'): LeaderboardCalendar => ({
  timezone: 'Africa/Cairo',
  weekStartsOn,
  seasons: [
    { key: '2025-26', startsOn: '2025-08-01', endsBefore: '2026-06-01' },
    { key: '2026-27', startsOn: '2026-08-01', endsBefore: '2027-06-01' },
  ],
});
const at = (iso: string) => new Date(iso);

describe('weekly periods in Africa/Cairo', () => {
  it('starts on Monday at local midnight (22:00 UTC in winter)', () => {
    expect(findPeriodContaining('WEEKLY', at('2026-11-12T10:00:00Z'), cairo())).toEqual({
      kind: 'WEEKLY',
      key: '2026-W46',
      startsAt: at('2026-11-08T22:00:00Z'),
      endsAt: at('2026-11-15T22:00:00Z'),
    });
  });

  it('puts Sunday 23:59 local in the old week and Monday 00:00 local in the new one', () => {
    expect(findPeriodContaining('WEEKLY', at('2026-11-15T21:59:59Z'), cairo())?.key).toBe('2026-W46');
    expect(findPeriodContaining('WEEKLY', at('2026-11-15T22:00:00Z'), cairo())?.key).toBe('2026-W47');
  });

  it('is an hour longer in the week the clocks go back (29 October 2026)', () => {
    const week = findPeriodContaining('WEEKLY', at('2026-10-29T12:00:00Z'), cairo());
    expect(week).toMatchObject({ startsAt: at('2026-10-25T21:00:00Z'), endsAt: at('2026-11-01T22:00:00Z') });
  });

  it('starts at 01:00 when the clocks skip local midnight (Friday 24 April 2026)', () => {
    const week = findPeriodContaining('WEEKLY', at('2026-04-25T12:00:00Z'), cairo('FRIDAY'));
    expect(week?.startsAt).toEqual(at('2026-04-23T22:00:00Z'));
  });

  it('names a Saturday week by the ISO week of its Saturday, and finds it again from the key', () => {
    const week = findPeriodContaining('WEEKLY', at('2026-11-12T10:00:00Z'), cairo('SATURDAY'));
    expect(week).toMatchObject({ key: '2026-W45', startsAt: at('2026-11-06T22:00:00Z') });
    expect(findPeriodByKey('WEEKLY', '2026-W45', cairo('SATURDAY'))).toEqual(week);
  });

  it('uses the ISO week-year at the turn of the year', () => {
    expect(findPeriodContaining('WEEKLY', at('2027-01-01T10:00:00Z'), cairo())?.key).toBe('2026-W53');
  });

  it('refuses keys that name no week', () => {
    for (const key of ['2026-W00', '2025-W53', '2026-W54', '2026-46', 'current']) {
      expect(findPeriodByKey('WEEKLY', key, cairo())).toBeNull();
    }
  });
});

describe('monthly periods in Africa/Cairo', () => {
  it('runs from the first local midnight of the month to the next', () => {
    expect(findPeriodContaining('MONTHLY', at('2026-11-30T21:59:59Z'), cairo())).toEqual({
      kind: 'MONTHLY',
      key: '2026-11',
      startsAt: at('2026-10-31T22:00:00Z'),
      endsAt: at('2026-11-30T22:00:00Z'),
    });
    expect(findPeriodByKey('MONTHLY', '2026-10', cairo())?.startsAt).toEqual(at('2026-09-30T21:00:00Z'));
  });

  it('refuses month 13 and other shapes', () => {
    expect(findPeriodByKey('MONTHLY', '2026-13', cairo())).toBeNull();
    expect(findPeriodByKey('MONTHLY', '2026-1', cairo())).toBeNull();
  });
});

describe('seasonal and all-time periods', () => {
  it('finds the configured season, or none between seasons', () => {
    expect(findPeriodContaining('SEASONAL', at('2026-11-12T10:00:00Z'), cairo())).toMatchObject({
      key: '2026-27',
      startsAt: at('2026-07-31T21:00:00Z'),
    });
    expect(findPeriodContaining('SEASONAL', at('2026-07-01T10:00:00Z'), cairo())).toBeNull();
    expect(findPeriodByKey('SEASONAL', '2030-31', cairo())).toBeNull();
  });

  it('has one all-time period that never ends', () => {
    expect(findPeriodContaining('ALL_TIME', at('2026-11-12T10:00:00Z'), cairo())).toMatchObject({
      key: 'all',
      endsAt: null,
    });
    expect(findPeriodByKey('ALL_TIME', 'all', cairo())).not.toBeNull();
  });
});

describe('period lists', () => {
  it('lists every period a time range touches', () => {
    const keys = listPeriodsBetween('WEEKLY', at('2026-11-15T21:00:00Z'), at('2026-11-15T23:00:00Z'), cairo());
    expect(keys.map((period) => period.key)).toEqual(['2026-W46', '2026-W47']);
    expect(listPeriodsBetween('SEASONAL', at('2026-07-01T00:00:00Z'), at('2026-07-02T00:00:00Z'), cairo())).toEqual([]);
  });

  it('lists the current period and the ones before it, newest first', () => {
    const now = at('2026-11-12T10:00:00Z');
    expect(listRecentPeriods('WEEKLY', now, cairo(), 3).map((period) => period.key)).toEqual([
      '2026-W46',
      '2026-W45',
      '2026-W44',
    ]);
    expect(listRecentPeriods('MONTHLY', now, cairo(), 2).map((period) => period.key)).toEqual(['2026-11', '2026-10']);
    expect(listRecentPeriods('SEASONAL', now, cairo(), 5).map((period) => period.key)).toEqual(['2026-27', '2025-26']);
    expect(listRecentPeriods('ALL_TIME', now, cairo(), 5).map((period) => period.key)).toEqual(['all']);
  });

  it('closes a period at its end', () => {
    const week = findPeriodByKey('WEEKLY', '2026-W46', cairo());
    if (!week) throw new Error('week missing');
    expect(findPeriodStatus(week, at('2026-11-15T21:59:59Z'))).toBe('OPEN');
    expect(findPeriodStatus(week, at('2026-11-15T22:00:00Z'))).toBe('CLOSED');
  });
});
