import type { NewPointEntry, ScoredGame } from '../../domain/battle-ledger-entries';

export const POINT_LEDGER_REPOSITORY = Symbol('POINT_LEDGER_REPOSITORY');

export interface PointLedgerRepository {
  /** Inserts the entries that are not recorded yet (unique source key) and returns only those. */
  insertNewEntries(entries: NewPointEntry[]): Promise<NewPointEntry[]>;
  sumPointsOfUsers(userIds: readonly string[], category: ScoredGame, window: TimeWindow): Promise<UserPointsSum[]>;
}

/** `to` null = no end. */
export interface TimeWindow {
  from: Date;
  to: Date | null;
}

export interface UserPointsSum {
  userId: string;
  points: number;
  lastScoredAt: Date;
}
