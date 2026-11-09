import { createHash } from 'node:crypto';
import type { ProviderMatch, ProviderSquadPlayer, ProviderTeam } from '../../application/ports/football-data-provider';
import type { LocalizedNames } from '../../domain/localized-names';

const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;
const MATCH_LENGTH = 115 * 60 * 1000;
const WEEKS_BEFORE_ANCHOR = 3;
const SQUAD_SIZE = 25;
const STARTER_SHIRTS = new Set([1, 4, 5, 6, 7, 12, 13, 14, 20, 21, 22]);
const SUBSTITUTE_SHIRTS = new Set([2, 8, 9, 15, 16, 23, 24]);

export interface PlayerNames {
  readonly first: readonly LocalizedNames[];
  readonly last: readonly LocalizedNames[];
}

export interface SeedCompetition {
  readonly code: string;
  readonly teams: readonly string[];
}

export function hashNumber(text: string, salt = 0): number {
  return createHash('sha256')
    .update(text)
    .digest()
    .readUInt32BE(salt * 4);
}

/** Circle method: everyone plays everyone, home and away. */
export function roundRobin(teams: readonly string[]): [string, string][][] {
  const circle = [...teams];
  const firstLeg: [string, string][][] = [];
  for (let round = 0; round < teams.length - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < teams.length / 2; i++) {
      const home = circle[i];
      const away = circle[teams.length - 1 - i];
      pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
    }
    firstLeg.push(pairs);
    circle.splice(1, 0, circle.pop() as string);
  }
  const secondLeg = firstLeg.map((round) => round.map(([home, away]): [string, string] => [away, home]));
  return [...firstLeg, ...secondLeg];
}

function statusAt(providerMatchId: string, kickoffMs: number, anchorMs: number) {
  const kickoffAt = new Date(kickoffMs);
  const unplayed = { startedAt: null, endedAt: null, homeScore: null, awayScore: null, decidedBy: null };
  if (kickoffMs > anchorMs) return { status: 'SCHEDULED' as const, kickoffAt, ...unplayed };
  if (kickoffMs + MATCH_LENGTH > anchorMs) {
    return { status: 'LIVE' as const, kickoffAt, ...unplayed, startedAt: kickoffAt, homeScore: 0, awayScore: 0 };
  }
  return {
    status: 'FINISHED' as const,
    kickoffAt,
    startedAt: kickoffAt,
    endedAt: new Date(kickoffMs + MATCH_LENGTH),
    homeScore: hashNumber(providerMatchId, 0) % 4,
    awayScore: hashNumber(providerMatchId, 1) % 4,
    decidedBy: 'REGULAR_TIME' as const,
  };
}

/** The whole schedule is a pure function of the anchor, so each sync reproduces the same matches. */
export function generateFixtures(
  competitions: readonly SeedCompetition[],
  teams: ReadonlyMap<string, ProviderTeam>,
  anchor: Date,
): ProviderMatch[] {
  const start = Math.floor(anchor.getTime() / HOUR) * HOUR - HOUR;
  return competitions.flatMap((competition, competitionIndex) =>
    roundRobin(competition.teams).flatMap((round, roundIndex) =>
      round.map(([home, away], slot) => {
        const providerMatchId = `${competition.code}:${String(roundIndex + 1)}:${home}-${away}`;
        const offset = (roundIndex - WEEKS_BEFORE_ANCHOR) * WEEK + competitionIndex * (HOUR / 2) + slot * 3 * HOUR;
        return {
          providerMatchId,
          competitionCode: competition.code,
          roundLabel: `Round ${String(roundIndex + 1)}`,
          homeTeam: teams.get(home) as ProviderTeam,
          awayTeam: teams.get(away) as ProviderTeam,
          ...statusAt(providerMatchId, start + offset, anchor.getTime()),
          homePenalties: null,
          awayPenalties: null,
          updatedAt: anchor,
        };
      }),
    ),
  );
}

function positionOf(shirt: number): string {
  if (shirt <= 3) return 'GK';
  if (shirt <= 11) return 'DF';
  if (shirt <= 19) return 'MF';
  return 'FW';
}

export function generateSquad(team: ProviderTeam, names: PlayerNames): ProviderSquadPlayer[] {
  return Array.from({ length: SQUAD_SIZE }, (_, index) => index + 1).flatMap((shirt) => {
    const role = STARTER_SHIRTS.has(shirt) ? 'STARTER' : SUBSTITUTE_SHIRTS.has(shirt) ? 'SUBSTITUTE' : null;
    if (!role) return [];
    const ref = `${team.ref}-${String(shirt)}`;
    const first = names.first[hashNumber(ref, 0) % names.first.length];
    const last = names.last[hashNumber(ref, 1) % names.last.length];
    return [
      {
        player: {
          ref,
          names: { en: `${first.en} ${last.en}`, ar: `${first.ar ?? first.en} ${last.ar ?? last.en}` },
          position: positionOf(shirt),
          nationalityCode: team.countryCode,
        },
        teamRef: team.ref,
        role,
        shirtNumber: shirt,
      },
    ];
  });
}
