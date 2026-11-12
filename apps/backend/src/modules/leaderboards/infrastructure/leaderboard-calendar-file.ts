import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { type LeaderboardCalendar, WEEKDAYS } from '../domain/period-calendar';

const localDate = z.iso.date();
const calendarFile = z
  .strictObject({
    devOnly: z.boolean(),
    timezone: z.string().refine((timezone) => Intl.supportedValuesOf('timeZone').includes(timezone), {
      message: 'must be an IANA time zone, e.g. Africa/Cairo',
    }),
    weekStartsOn: z.enum(WEEKDAYS),
    seasons: z.array(z.strictObject({ key: z.string().min(1), startsOn: localDate, endsBefore: localDate })),
  })
  .refine(
    ({ seasons }) =>
      seasons.every(
        (season, index) =>
          season.startsOn < season.endsBefore && (index === 0 || seasons[index - 1].endsBefore <= season.startsOn),
      ),
    { message: 'seasons must be in order, each ending before the next starts', path: ['seasons'] },
  )
  .refine(({ seasons }) => new Set(seasons.map((season) => season.key)).size === seasons.length, {
    message: 'season keys must be unique',
    path: ['seasons'],
  });

/** Reads the leaderboard calendar (03 §5.6). Fails the boot on a bad file, or on placeholder values in production. */
export function loadLeaderboardCalendarFile(path: string, isProduction: boolean): LeaderboardCalendar {
  const result = calendarFile.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!result.success) throw new Error(`Invalid leaderboard config ${path}:\n${z.prettifyError(result.error)}`);
  if (isProduction && result.data.devOnly) {
    throw new Error(`Leaderboard config ${path} holds placeholder season dates ("devOnly": true, DEC-17).`);
  }
  const { timezone, weekStartsOn, seasons } = result.data;
  return { timezone, weekStartsOn, seasons };
}
