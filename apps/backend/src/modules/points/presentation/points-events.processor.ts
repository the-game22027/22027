import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import type { OutboxEnvelope } from '@shared/infrastructure/outbox';
import { RecordBattlePoints } from '../application/record-battle-points';

export const POINTS_QUEUE = 'points';

// The event belongs to battles; points only reads the fields it needs (01 §6).
const battleCompletedPayload = z.object({
  battleId: z.uuid(),
  mode: z.enum(['MATCHMAKING', 'ROOM']),
  gameType: z.string(),
  hasBot: z.boolean(),
  roomId: z.uuid().nullable(),
  endedAt: z.iso.datetime(),
  ruleSetId: z.uuid().nullable().default(null),
  participants: z.array(
    z.object({
      participantId: z.uuid(),
      kind: z.enum(['HUMAN', 'BOT']),
      userId: z.uuid().nullable(),
      points: z.number().int().min(0),
    }),
  ),
});

/** Consumes the events the points module subscribes to (points-jobs.module.ts). */
@Processor(POINTS_QUEUE, { concurrency: 4 })
export class PointsEventsProcessor extends WorkerHost {
  constructor(private readonly recordBattlePoints: RecordBattlePoints) {
    super();
  }

  async process(job: Job<OutboxEnvelope>): Promise<{ recorded: number }> {
    const { type, payload } = job.data;
    if (type !== 'BattleCompleted') throw new Error(`The points queue does not handle ${type}`);
    const battle = battleCompletedPayload.parse(payload);
    const recorded = await this.recordBattlePoints.recordPointsOfBattle({
      ...battle,
      endedAt: new Date(battle.endedAt),
    });
    return { recorded };
  }
}
