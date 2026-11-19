import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Prisma } from '@generated/prisma/client';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { summarizeRoundForQuestionStats } from '../domain/question-results';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { FirstMoverOutcome } from '../domain/first-mover/next-first-mover';
import type { RoundAction, RoundResult } from '../domain/games/game-rules';
import type { BattleCompletion, BattleRepository, NewBattle } from '../application/ports/battle-repository';

const UNFINISHED: ('WAITING_READY' | 'IN_PROGRESS')[] = ['WAITING_READY', 'IN_PROGRESS'];

@Injectable()
export class PrismaBattleRepository implements BattleRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    private readonly outbox: OutboxWriter,
  ) {}

  async createBattle(battle: NewBattle): Promise<void> {
    await this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx;
      await tx.battle.create({
        data: {
          id: battle.id,
          status: 'WAITING_READY',
          mode: battle.mode,
          gameType: battle.gameType,
          hasBot: battle.hasBot,
          config: battle.config as unknown as Prisma.InputJsonValue,
          ruleSetId: battle.ruleSetId,
          createdAt: battle.createdAt,
          readyDeadlineAt: battle.readyDeadlineAt,
        },
      });
      await tx.battleParticipant.createMany({
        data: battle.participants.map((participant) => ({
          ...participant,
          battleId: battle.id,
          botDisplay: participant.botDisplay ?? undefined,
        })),
      });
      await tx.battleRound.createMany({
        data: battle.questionIds.map((questionId, index) => ({ battleId: battle.id, roundNo: index + 1, questionId })),
      });
    });
  }

  async markParticipantReady(participantId: string, at: Date): Promise<void> {
    await this.txHost.tx.battleParticipant.update({ where: { id: participantId }, data: { readyAt: at } });
  }

  async markBattleStarted(battleId: string, at: Date): Promise<void> {
    await this.txHost.tx.battle.update({
      where: { id: battleId },
      data: { status: 'IN_PROGRESS', startedAt: at, version: { increment: 1 } },
    });
  }

  async saveFirstMoverOutcomes(battleId: string, outcomes: readonly FirstMoverOutcome[]): Promise<void> {
    await this.txHost.tx.battle.update({
      where: { id: battleId },
      data: { firstMover: outcomes as unknown as Prisma.InputJsonValue },
    });
  }

  async markRoundStarted(battleId: string, roundNo: number, at: Date): Promise<void> {
    await this.txHost.tx.battleRound.update({
      where: { battleId_roundNo: { battleId, roundNo } },
      data: { startedAt: at },
    });
  }

  async recordRoundAction(
    battleId: string,
    roundNo: number,
    actionNo: number,
    action: RoundAction,
    clientMsgId: string | null,
  ): Promise<void> {
    const answer = action.answer;
    await this.txHost.tx.battleRoundAction.create({
      data: {
        battleId,
        roundNo,
        actionNo,
        participantId: action.participantId,
        kind: action.kind,
        entityId: answer && 'entityId' in answer ? answer.entityId : null,
        numberAnswer: answer && 'number' in answer ? answer.number : null,
        answerText: answer && 'text' in answer ? answer.text : null,
        answerMatch: answer && 'match' in answer ? answer.match : null,
        isCorrect: action.isCorrect ?? null,
        points: action.points,
        clientMsgId,
        receivedAt: action.at,
      },
    });
  }

  async closeRound(battleId: string, roundNo: number, result: RoundResult, closedAt: Date): Promise<void> {
    await this.txHost.tx.battleRound.update({
      where: { battleId_roundNo: { battleId, roundNo } },
      data: {
        closedAt,
        stepsRevealed: result.stepsRevealed,
        winnerParticipantId: result.winnerParticipantId,
        endReason: result.endReason,
      },
    });
  }

  async completeBattle({
    battleId,
    endedAt,
    endReason,
    placements,
    leaderboardPoints,
  }: BattleCompletion): Promise<void> {
    await this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx;
      for (const { participantId, score, placement, outcome } of placements) {
        await tx.battleParticipant.update({ where: { id: participantId }, data: { score, placement, outcome } });
      }
      const battle = await tx.battle.update({
        where: { id: battleId },
        data: { status: 'COMPLETED', endedAt, endReason, version: { increment: 1 } },
        include: { participants: true, rounds: { orderBy: { roundNo: 'asc' }, include: { actions: true } } },
      });
      const humanIds = new Set(
        battle.participants.filter((participant) => participant.kind === 'HUMAN').map((participant) => participant.id),
      );
      await this.outbox.write({
        type: 'BattleCompleted',
        version: 1,
        aggregateType: 'battle',
        aggregateId: battleId,
        occurredAt: endedAt,
        payload: {
          battleId,
          mode: battle.mode,
          gameType: battle.gameType,
          hasBot: battle.hasBot,
          roomId: battle.roomId,
          endedAt: endedAt.toISOString(),
          endReason,
          ruleSetId: battle.ruleSetId,
          participants: battle.participants.map((participant) => ({
            participantId: participant.id,
            kind: participant.kind,
            userId: participant.userId,
            score: participant.score,
            placement: participant.placement,
            outcome: participant.outcome,
            points: leaderboardPoints[participant.id] ?? 0,
          })),
          questionResults: battle.rounds.map((round) => summarizeRoundForQuestionStats(round, humanIds)),
        },
      });
    });
  }

  async cancelBattle(battleId: string, at: Date, endReason: 'CANCELLED'): Promise<void> {
    await this.txHost.tx.battle.updateMany({
      where: { id: battleId, status: 'WAITING_READY' },
      data: { status: 'CANCELLED', endedAt: at, endReason, version: { increment: 1 } },
    });
  }

  async abandonBattle(battleId: string, at: Date): Promise<void> {
    await this.txHost.tx.battle.updateMany({
      where: { id: battleId, status: { in: UNFINISHED } },
      data: { status: 'ABANDONED', endedAt: at, endReason: 'ABANDONED', version: { increment: 1 } },
    });
  }

  async markParticipantDisconnected(participantId: string, at: Date | null): Promise<void> {
    await this.txHost.tx.battleParticipant.update({ where: { id: participantId }, data: { disconnectedAt: at } });
  }

  async markParticipantForfeited(participantId: string, at: Date): Promise<void> {
    await this.txHost.tx.battleParticipant.update({ where: { id: participantId }, data: { forfeitedAt: at } });
  }

  async abandonUnfinishedBattles(at: Date): Promise<{ battleIds: string[]; userIds: string[] }> {
    return this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx;
      const unfinished = await tx.battle.findMany({ where: { status: { in: UNFINISHED } }, select: { id: true } });
      const battleIds = unfinished.map((battle) => battle.id);
      if (battleIds.length === 0) return { battleIds, userIds: [] };
      await tx.battle.updateMany({
        where: { id: { in: battleIds }, status: { in: UNFINISHED } },
        data: { status: 'ABANDONED', endedAt: at, endReason: 'ABANDONED', version: { increment: 1 } },
      });
      const humans = await tx.battleParticipant.findMany({
        where: { battleId: { in: battleIds }, userId: { not: null } },
        select: { userId: true },
      });
      return { battleIds, userIds: [...new Set(humans.flatMap((human) => (human.userId ? [human.userId] : [])))] };
    });
  }

  async findRecentlyPlayedQuestionIds(userId: string, battleCount: number): Promise<string[]> {
    if (battleCount === 0) return [];
    // UUID v7 ids are time-ordered, so the highest battle ids are the most recent battles (02 §4.8).
    const rows = await this.txHost.tx.$queryRaw<{ question_id: string }[]>`
      SELECT DISTINCT r.question_id
      FROM (SELECT battle_id FROM battle_participants
            WHERE user_id = ${userId}::uuid ORDER BY battle_id DESC LIMIT ${battleCount}) recent
      JOIN battle_rounds r ON r.battle_id = recent.battle_id`;
    return rows.map((row) => row.question_id);
  }

  async wasQuestionServedToUser(questionId: string, userId: string): Promise<boolean> {
    const [row] = await this.txHost.tx.$queryRaw<{ served: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM battle_rounds r
        JOIN battle_participants p ON p.battle_id = r.battle_id
        WHERE r.question_id = ${questionId}::uuid AND p.user_id = ${userId}::uuid AND r.started_at IS NOT NULL
      ) AS served`;
    return row?.served ?? false;
  }
}
