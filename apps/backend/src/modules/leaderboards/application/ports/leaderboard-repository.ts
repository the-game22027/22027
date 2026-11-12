import type { UserPointsSum } from '@modules/points';
import type { Board } from '../../domain/boards';
import type { Period, PeriodKind } from '../../domain/period-calendar';

export const LEADERBOARD_REPOSITORY = Symbol('LEADERBOARD_REPOSITORY');
export const LEADERBOARD_CALENDAR = Symbol('LEADERBOARD_CALENDAR');

/** Where a row sits in the board's order (03 §5.4): the keyset cursor. */
export interface RowPosition {
  points: number;
  tiebreak1: number;
  tiebreak2: number;
  userId: string;
}

export interface RankedRow extends RowPosition {
  /** Equal points share a rank (1, 1, 3). */
  rank: number;
}

export interface LeaderboardRepository {
  /** Creates the period row on first use; returns its id. */
  savePeriod(period: Period, board: Board, timezone: string): Promise<string>;
  findPeriodId(kind: PeriodKind, board: Board, periodKey: string): Promise<string | null>;
  /** Holds until the transaction ends. Takes the players in the order given, so callers pass them sorted. */
  waitForOtherUpdatesOfPlayers(board: Board, userIds: readonly string[]): Promise<void>;
  /** Writes each player's total as computed from the ledger; players with no points lose their row. */
  replacePlayerTotals(periodId: string, sums: UserPointsSum[], playersWithoutPoints: string[], at: Date): Promise<void>;
  listRowsAfter(periodId: string, after: RowPosition | null, limit: number): Promise<RankedRow[]>;
  /** The rows just above a position, nearest last (board order). */
  listRowsBefore(periodId: string, before: RowPosition, limit: number): Promise<RankedRow[]>;
  findRowOfPlayer(periodId: string, userId: string): Promise<RankedRow | null>;
}
