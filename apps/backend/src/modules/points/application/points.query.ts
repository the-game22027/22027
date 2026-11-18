import { Inject, Injectable } from '@nestjs/common';
import type { LedgerCategory } from '../domain/battle-ledger-entries';
import {
  POINT_LEDGER_REPOSITORY,
  type PointLedgerRepository,
  type TimeWindow,
  type UserPointsSum,
} from './ports/point-ledger-repository';

/** Ledger reads for other modules (01 §2.9): leaderboards rebuild their rows from these sums. */
@Injectable()
export class PointsQuery {
  constructor(@Inject(POINT_LEDGER_REPOSITORY) private readonly ledger: PointLedgerRepository) {}

  /** Live (not superseded) points of each user in [from, to); users without any are left out. */
  sumPointsOfUsers(userIds: readonly string[], category: LedgerCategory, window: TimeWindow): Promise<UserPointsSum[]> {
    return this.ledger.sumPointsOfUsers(userIds, category, window);
  }
}
