import { InvalidPicksError } from './prediction-errors';

export interface ExactScore {
  readonly home: number;
  readonly away: number;
}

export type Outcome = 'HOME' | 'DRAW' | 'AWAY';

export interface SubmittedPick {
  readonly type: string;
  readonly home?: number;
  readonly away?: number;
}

const inRange = (goals: number | undefined, maxGoals: number): goals is number =>
  Number.isInteger(goals) && (goals as number) >= 0 && (goals as number) <= maxGoals;

/** DEC-03: the exact score is the only pick a user enters. */
export function exactScoreFrom(picks: readonly SubmittedPick[], maxGoals: number): ExactScore {
  if (picks.length !== 1 || picks[0].type !== 'EXACT_SCORE') {
    throw new InvalidPicksError('Send exactly one EXACT_SCORE pick.');
  }
  const { home, away } = picks[0];
  if (!inRange(home, maxGoals) || !inRange(away, maxGoals)) {
    throw new InvalidPicksError(`Goals must be whole numbers from 0 to ${String(maxGoals)}.`);
  }
  return { home, away };
}

export function outcomeOf({ home, away }: ExactScore): Outcome {
  if (home > away) return 'HOME';
  return home < away ? 'AWAY' : 'DRAW';
}

export const sameScore = (a: ExactScore, b: ExactScore): boolean => a.home === b.home && a.away === b.away;
