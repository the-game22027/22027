export type PeriodKind = 'WEEKLY' | 'MONTHLY' | 'SEASONAL' | 'ALL_TIME';
export const PERIOD_KINDS: readonly PeriodKind[] = ['WEEKLY', 'MONTHLY', 'SEASONAL', 'ALL_TIME'];

export type Weekday = 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
/** Index = JavaScript's `getUTCDay()` (0 = Sunday). */
export const WEEKDAYS: readonly Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

/** A football season in local dates: `endsBefore` is the first day after it (03 §5.6, DEC-17). */
export interface Season {
  key: string;
  startsOn: string;
  endsBefore: string;
}

/** Where period boundaries fall (DEC-15/16/17). */
export interface LeaderboardCalendar {
  /** IANA name, e.g. `Africa/Cairo`. */
  timezone: string;
  weekStartsOn: Weekday;
  seasons: readonly Season[];
}

export interface Period {
  kind: PeriodKind;
  key: string;
  startsAt: Date;
  /** null for ALL_TIME. */
  endsAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_TIME_KEY = 'all';

/** A calendar day with no time zone, stored as the UTC midnight of that day so day arithmetic is plain. */
interface CivilDay {
  utcMidnight: number;
}

const civilDay = (year: number, month: number, day: number): CivilDay => ({
  utcMidnight: Date.UTC(year, month - 1, day),
});
const addDays = (day: CivilDay, days: number): CivilDay => ({ utcMidnight: day.utcMidnight + days * DAY_MS });
const weekdayIndexOf = (day: CivilDay): number => new Date(day.utcMidnight).getUTCDay();
const yearOf = (day: CivilDay): number => new Date(day.utcMidnight).getUTCFullYear();
const pad = (value: number): string => String(value).padStart(2, '0');

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** The wall clock in `timezone` at `at`, as if it were UTC (milliseconds dropped). */
function wallClockAsUtc(at: number, timezone: string): number {
  const parts = Object.fromEntries(
    formatterFor(timezone)
      .formatToParts(new Date(at))
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

const utcOffsetAt = (at: number, timezone: string): number =>
  wallClockAsUtc(at - (at % 1000), timezone) - (at - (at % 1000));

/**
 * The first instant of a local day. When the clock jumps over local midnight (daylight saving starting
 * at 00:00, as in Cairo), that is the first instant that exists, e.g. 01:00.
 */
function findStartOfLocalDay(day: CivilDay, timezone: string): Date {
  const guess = day.utcMidnight - utcOffsetAt(day.utcMidnight, timezone);
  const corrected = day.utcMidnight - utcOffsetAt(guess, timezone);
  return new Date(corrected);
}

function findLocalDay(at: Date, timezone: string): CivilDay {
  const wall = new Date(wallClockAsUtc(at.getTime(), timezone));
  return civilDay(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate());
}

function parseLocalDate(text: string): CivilDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = civilDay(year, month, day);
  const check = new Date(parsed.utcMidnight);
  return check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? parsed : null;
}

/** `2026-W46`: the ISO week-numbering year and week of a day. */
function formatIsoWeekKey(day: CivilDay): string {
  const thursday = addDays(day, 3 - ((weekdayIndexOf(day) + 6) % 7));
  const isoYear = yearOf(thursday);
  const week = 1 + Math.floor((thursday.utcMidnight - civilDay(isoYear, 1, 1).utcMidnight) / (7 * DAY_MS));
  return `${String(isoYear)}-W${pad(week)}`;
}

function findIsoMonday(isoYear: number, week: number): CivilDay {
  const january4 = civilDay(isoYear, 1, 4);
  const firstMonday = addDays(january4, -((weekdayIndexOf(january4) + 6) % 7));
  return addDays(firstMonday, 7 * (week - 1));
}

function buildWeek(firstDay: CivilDay, calendar: LeaderboardCalendar): Period {
  return {
    kind: 'WEEKLY',
    key: formatIsoWeekKey(firstDay),
    startsAt: findStartOfLocalDay(firstDay, calendar.timezone),
    endsAt: findStartOfLocalDay(addDays(firstDay, 7), calendar.timezone),
  };
}

function buildMonth(year: number, month: number, calendar: LeaderboardCalendar): Period {
  const next = month === 12 ? civilDay(year + 1, 1, 1) : civilDay(year, month + 1, 1);
  return {
    kind: 'MONTHLY',
    key: `${String(year)}-${pad(month)}`,
    startsAt: findStartOfLocalDay(civilDay(year, month, 1), calendar.timezone),
    endsAt: findStartOfLocalDay(next, calendar.timezone),
  };
}

function buildSeason(season: Season, calendar: LeaderboardCalendar): Period {
  const startsOn = parseLocalDate(season.startsOn);
  const endsBefore = parseLocalDate(season.endsBefore);
  if (!startsOn || !endsBefore) throw new Error(`Season ${season.key} has an invalid date`);
  return {
    kind: 'SEASONAL',
    key: season.key,
    startsAt: findStartOfLocalDay(startsOn, calendar.timezone),
    endsAt: findStartOfLocalDay(endsBefore, calendar.timezone),
  };
}

const ALL_TIME: Period = { kind: 'ALL_TIME', key: ALL_TIME_KEY, startsAt: new Date(0), endsAt: null };

/** The period of this kind that `at` falls in; null only for a time outside every season. */
export function findPeriodContaining(kind: PeriodKind, at: Date, calendar: LeaderboardCalendar): Period | null {
  switch (kind) {
    case 'WEEKLY': {
      const day = findLocalDay(at, calendar.timezone);
      const daysSinceWeekStart = (weekdayIndexOf(day) - WEEKDAYS.indexOf(calendar.weekStartsOn) + 7) % 7;
      return buildWeek(addDays(day, -daysSinceWeekStart), calendar);
    }
    case 'MONTHLY': {
      const day = new Date(findLocalDay(at, calendar.timezone).utcMidnight);
      return buildMonth(day.getUTCFullYear(), day.getUTCMonth() + 1, calendar);
    }
    case 'SEASONAL':
      return (
        calendar.seasons
          .map((season) => buildSeason(season, calendar))
          .find((season) => season.startsAt <= at && season.endsAt !== null && at < season.endsAt) ?? null
      );
    case 'ALL_TIME':
      return ALL_TIME;
  }
}

/** The period a key names; null when the key is malformed or names a season the calendar does not have. */
export function findPeriodByKey(kind: PeriodKind, key: string, calendar: LeaderboardCalendar): Period | null {
  switch (kind) {
    case 'WEEKLY': {
      const match = /^(\d{4})-W(\d{2})$/.exec(key);
      if (!match) return null;
      const monday = findIsoMonday(Number(match[1]), Number(match[2]));
      const firstDay = addDays(monday, (WEEKDAYS.indexOf(calendar.weekStartsOn) + 6) % 7);
      // Rejects W00, W54 and W53 in a year that has only 52 weeks.
      return formatIsoWeekKey(firstDay) === key ? buildWeek(firstDay, calendar) : null;
    }
    case 'MONTHLY': {
      const match = /^(\d{4})-(\d{2})$/.exec(key);
      if (!match) return null;
      const month = Number(match[2]);
      return month >= 1 && month <= 12 ? buildMonth(Number(match[1]), month, calendar) : null;
    }
    case 'SEASONAL': {
      const season = calendar.seasons.find((candidate) => candidate.key === key);
      return season ? buildSeason(season, calendar) : null;
    }
    case 'ALL_TIME':
      return key === ALL_TIME_KEY ? ALL_TIME : null;
  }
}

/** Every period of this kind that overlaps [from, to]: usually one, more when the range crosses a boundary. */
export function listPeriodsBetween(kind: PeriodKind, from: Date, to: Date, calendar: LeaderboardCalendar): Period[] {
  if (kind === 'SEASONAL') {
    return calendar.seasons
      .map((season) => buildSeason(season, calendar))
      .filter((season) => season.startsAt <= to && season.endsAt !== null && from < season.endsAt);
  }
  const periods: Period[] = [];
  let period = findPeriodContaining(kind, from, calendar);
  while (period && period.startsAt <= to) {
    periods.push(period);
    if (!period.endsAt) break;
    period = findPeriodContaining(kind, period.endsAt, calendar);
  }
  return periods;
}

/** The current period and the ones before it, newest first. */
export function listRecentPeriods(kind: PeriodKind, now: Date, calendar: LeaderboardCalendar, count: number): Period[] {
  if (kind === 'SEASONAL') {
    return calendar.seasons
      .map((season) => buildSeason(season, calendar))
      .filter((season) => season.startsAt <= now)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, count);
  }
  const periods: Period[] = [];
  let period = findPeriodContaining(kind, now, calendar);
  while (period && periods.length < count) {
    periods.push(period);
    if (period.kind === 'ALL_TIME') break;
    period = findPeriodContaining(kind, new Date(period.startsAt.getTime() - 1), calendar);
  }
  return periods;
}

/** Derived from the clock until the prize work stores closing (03 §5.6). */
export function findPeriodStatus(period: Period, now: Date): 'OPEN' | 'CLOSED' {
  return period.endsAt === null || now < period.endsAt ? 'OPEN' : 'CLOSED';
}
