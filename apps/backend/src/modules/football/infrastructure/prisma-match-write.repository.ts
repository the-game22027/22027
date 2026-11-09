import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type {
  MatchState,
  MatchWriteRepository,
  NewMatch,
  StoredMatch,
} from '../application/ports/match-write-repository';

@Injectable()
export class PrismaMatchWriteRepository implements MatchWriteRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async findForUpdate(provider: string, providerMatchId: string): Promise<StoredMatch | null> {
    const rows = await this.txHost.tx.$queryRaw<StoredMatch[]>`
      SELECT id::text, status::text, kickoff_at AS "kickoffAt", started_at AS "startedAt", ended_at AS "endedAt",
             home_score AS "homeScore", away_score AS "awayScore", decided_by::text AS "decidedBy",
             home_penalties AS "homePenalties", away_penalties AS "awayPenalties",
             result_version AS "resultVersion", provider_updated_at AS "providerUpdatedAt"
      FROM matches
      WHERE provider = ${provider} AND provider_match_id = ${providerMatchId}
      FOR UPDATE`;
    return rows[0] ?? null;
  }

  async insertIfAbsent(match: NewMatch): Promise<boolean> {
    const { state, ...identity } = match;
    const { count } = await this.txHost.tx.match.createMany({
      data: [{ ...identity, ...state }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async update(matchId: string, state: MatchState, providerUpdatedAt: Date, changed: boolean): Promise<void> {
    await this.txHost.tx.match.update({
      where: { id: matchId },
      data: { ...state, providerUpdatedAt, ...(changed ? { version: { increment: 1 } } : {}) },
    });
  }
}
