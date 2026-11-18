import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { Prisma } from '@generated/prisma/client';
import type {
  OwnedPrediction,
  PredictionKey,
  PredictionRepository,
  PredictionRevisionWrite,
  PredictionStatus,
  StoredPrediction,
} from '../application/ports/prediction-repository';

interface PredictionRow {
  id: string;
  matchId: string;
  status: PredictionStatus;
  revision: number;
  updatedAt: Date;
  home: number;
  away: number;
}

const toPrediction = ({ home, away, ...prediction }: PredictionRow): StoredPrediction => ({
  ...prediction,
  score: { home, away },
});

interface OwnedPredictionRow extends PredictionRow {
  userId: string;
  createdAt: Date;
}

const toOwnedPrediction = ({ userId, createdAt, ...row }: OwnedPredictionRow): OwnedPrediction => ({
  ...toPrediction(row),
  userId,
  createdAt,
});

const OWNED_PREDICTION_COLUMNS = Prisma.sql`
  p.id::text, p.user_id::text AS "userId", p.match_id::text AS "matchId", p.status::text, p.revision,
  p.created_at AS "createdAt", p.updated_at AS "updatedAt", pick.home_score AS home, pick.away_score AS away`;

@Injectable()
export class PrismaPredictionRepository implements PredictionRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async lockMatchIfPredictable(matchId: string): Promise<boolean> {
    const rows = await this.txHost.tx.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM matches
      WHERE id = ${matchId}::uuid AND status = 'SCHEDULED' AND kickoff_at > now()
      FOR SHARE`;
    return rows.length === 1;
  }

  async findForUpdate({ userId, matchId }: PredictionKey): Promise<StoredPrediction | null> {
    const rows = await this.txHost.tx.$queryRaw<PredictionRow[]>`
      SELECT p.id::text, p.match_id::text AS "matchId", p.status::text, p.revision, p.updated_at AS "updatedAt",
             pick.home_score AS home, pick.away_score AS away
      FROM predictions p
      JOIN prediction_picks pick ON pick.prediction_id = p.id AND pick.pick_type = 'EXACT_SCORE'
      WHERE p.user_id = ${userId}::uuid AND p.match_id = ${matchId}::uuid
      FOR UPDATE OF p`;
    return rows.length === 1 ? toPrediction(rows[0]) : null;
  }

  async insertIfAbsent(id: string, { userId, matchId }: PredictionKey): Promise<boolean> {
    const inserted = await this.txHost.tx.$executeRaw`
      INSERT INTO predictions (id, user_id, match_id, revision, created_at, updated_at)
      VALUES (${id}::uuid, ${userId}::uuid, ${matchId}::uuid, 0, now(), now())
      ON CONFLICT (user_id, match_id) DO NOTHING`;
    return inserted === 1;
  }

  async saveRevision({ predictionId, revisionId, revision, score, requestId }: PredictionRevisionWrite): Promise<void> {
    const { tx } = this.txHost;
    const picks = JSON.stringify([{ type: 'EXACT_SCORE', home: score.home, away: score.away }]);
    await tx.$executeRaw`
      INSERT INTO prediction_picks (prediction_id, pick_type, home_score, away_score)
      VALUES (${predictionId}::uuid, 'EXACT_SCORE', ${score.home}::smallint, ${score.away}::smallint)
      ON CONFLICT (prediction_id, pick_type)
      DO UPDATE SET home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score`;
    await tx.$executeRaw`
      INSERT INTO prediction_revisions (id, prediction_id, revision, picks, submitted_at, request_id)
      VALUES (${revisionId}::uuid, ${predictionId}::uuid, ${revision}, ${picks}::jsonb, now(), ${requestId})`;
    await tx.$executeRaw`
      UPDATE predictions SET revision = ${revision}, updated_at = now() WHERE id = ${predictionId}::uuid`;
  }

  async findOwn({ userId, matchId }: PredictionKey): Promise<StoredPrediction | null> {
    const rows = await this.txHost.tx.$queryRaw<PredictionRow[]>`
      SELECT p.id::text, p.match_id::text AS "matchId", p.status::text, p.revision, p.updated_at AS "updatedAt",
             pick.home_score AS home, pick.away_score AS away
      FROM predictions p
      JOIN prediction_picks pick ON pick.prediction_id = p.id AND pick.pick_type = 'EXACT_SCORE'
      WHERE p.user_id = ${userId}::uuid AND p.match_id = ${matchId}::uuid`;
    return rows.length === 1 ? toPrediction(rows[0]) : null;
  }

  async listPredictionsOfUsersForMatch(
    matchId: string,
    userIds: readonly string[],
    afterUserId: string | null,
    limit: number,
  ): Promise<OwnedPrediction[]> {
    if (userIds.length === 0) return [];
    const rows = await this.txHost.tx.$queryRaw<OwnedPredictionRow[]>`
      SELECT ${OWNED_PREDICTION_COLUMNS}
      FROM predictions p
      JOIN prediction_picks pick ON pick.prediction_id = p.id AND pick.pick_type = 'EXACT_SCORE'
      WHERE p.match_id = ${matchId}::uuid AND p.user_id = ANY(${[...userIds]}::uuid[])
        ${afterUserId ? Prisma.sql`AND p.user_id > ${afterUserId}::uuid` : Prisma.empty}
      ORDER BY p.user_id
      LIMIT ${limit}`;
    return rows.map(toOwnedPrediction);
  }

  async listPredictionsOfUser(
    userId: string,
    after: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<OwnedPrediction[]> {
    const rows = await this.txHost.tx.$queryRaw<OwnedPredictionRow[]>`
      SELECT ${OWNED_PREDICTION_COLUMNS}
      FROM predictions p
      JOIN prediction_picks pick ON pick.prediction_id = p.id AND pick.pick_type = 'EXACT_SCORE'
      WHERE p.user_id = ${userId}::uuid
        ${after ? Prisma.sql`AND (p.created_at, p.id) < (${after.createdAt}, ${after.id}::uuid)` : Prisma.empty}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit}`;
    return rows.map(toOwnedPrediction);
  }
}
