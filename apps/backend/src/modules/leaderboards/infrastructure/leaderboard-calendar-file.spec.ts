import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLeaderboardCalendarFile } from './leaderboard-calendar-file';

const DEV_FILE = join(__dirname, '../../../../config/leaderboards.dev.json');
const directory = mkdtempSync(join(tmpdir(), 'leaderboard-calendar-'));
const writeCalendar = (content: object): string => {
  const path = join(directory, `${String(Math.random())}.json`);
  writeFileSync(path, JSON.stringify(content));
  return path;
};
const valid = {
  devOnly: false,
  timezone: 'Africa/Cairo',
  weekStartsOn: 'MONDAY',
  seasons: [{ key: '2026-27', startsOn: '2026-08-01', endsBefore: '2027-06-01' }],
};

describe('loadLeaderboardCalendarFile', () => {
  it('reads the dev calendar in Africa/Cairo (DEC-15/16)', () => {
    expect(loadLeaderboardCalendarFile(DEV_FILE, false)).toMatchObject({
      timezone: 'Africa/Cairo',
      weekStartsOn: 'MONDAY',
    });
  });

  it('refuses placeholder season dates in production', () => {
    expect(() => loadLeaderboardCalendarFile(DEV_FILE, true)).toThrow('placeholder season dates');
    expect(loadLeaderboardCalendarFile(writeCalendar(valid), true).seasons).toHaveLength(1);
  });

  it('refuses an unknown time zone, overlapping seasons and repeated keys', () => {
    expect(() => loadLeaderboardCalendarFile(writeCalendar({ ...valid, timezone: 'Africa/Atlantis' }), false)).toThrow(
      'IANA time zone',
    );
    const overlapping = [
      { key: 'a', startsOn: '2026-08-01', endsBefore: '2027-06-01' },
      { key: 'b', startsOn: '2027-05-01', endsBefore: '2028-06-01' },
    ];
    expect(() => loadLeaderboardCalendarFile(writeCalendar({ ...valid, seasons: overlapping }), false)).toThrow(
      'in order',
    );
    const repeated = [
      { key: 'a', startsOn: '2026-08-01', endsBefore: '2027-06-01' },
      { key: 'a', startsOn: '2027-08-01', endsBefore: '2028-06-01' },
    ];
    expect(() => loadLeaderboardCalendarFile(writeCalendar({ ...valid, seasons: repeated }), false)).toThrow('unique');
  });
});
