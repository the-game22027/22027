const MINUTE = 60_000;
const FULL_TIME_MINUTES = 115;
const PLAYED_MINUTES = 90;
const MAX_GOALS_PER_TEAM = 4;

export interface MatchdayFixture {
  readonly matchId: string;
  readonly kickoffAt: Date;
}

export interface Score {
  readonly home: number;
  readonly away: number;
}

export type MatchdayStep = { readonly atMs: number; readonly matchId: string } & (
  { readonly kind: 'KICKOFF' } | { readonly kind: 'SCORE' | 'FINISH'; readonly score: Score }
);

function pick(text: string, range: number): number {
  let hash = 0x811c9dc5;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 24) % range;
}

function goalsOf(matchId: string, side: 'home' | 'away') {
  return Array.from({ length: pick(`${matchId}:${side}`, MAX_GOALS_PER_TEAM) }, (_, goal) => ({
    side,
    minute: pick(`${matchId}:${side}:${String(goal)}`, PLAYED_MINUTES) + 1,
  }));
}

function planFixture({ matchId }: MatchdayFixture, startMs: number): MatchdayStep[] {
  const goals = [...goalsOf(matchId, 'home'), ...goalsOf(matchId, 'away')].sort((a, b) => a.minute - b.minute);
  const score = { home: 0, away: 0 };
  const scored = goals.map(({ side, minute }): MatchdayStep => {
    score[side] += 1;
    return { kind: 'SCORE', atMs: startMs + minute * MINUTE, matchId, score: { ...score } };
  });
  return [
    { kind: 'KICKOFF', atMs: startMs, matchId },
    ...scored,
    { kind: 'FINISH', atMs: startMs + FULL_TIME_MINUTES * MINUTE, matchId, score: { ...score } },
  ];
}

/** Steps are offsets from the first kickoff, and the same fixtures always produce the same day. */
export function planMatchday(fixtures: readonly MatchdayFixture[]): MatchdayStep[] {
  if (fixtures.length === 0) return [];
  const firstKickoff = Math.min(...fixtures.map((fixture) => fixture.kickoffAt.getTime()));
  return fixtures
    .flatMap((fixture) => planFixture(fixture, fixture.kickoffAt.getTime() - firstKickoff))
    .sort((a, b) => a.atMs - b.atMs);
}
