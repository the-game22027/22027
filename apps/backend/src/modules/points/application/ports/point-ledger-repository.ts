import type { NewPointEntry } from '../../domain/battle-ledger-entries';

export const POINT_LEDGER_REPOSITORY = Symbol('POINT_LEDGER_REPOSITORY');

export interface PointLedgerRepository {
  /** Inserts the entries that are not recorded yet (unique source key) and returns only those. */
  insertNewEntries(entries: NewPointEntry[]): Promise<NewPointEntry[]>;
}
