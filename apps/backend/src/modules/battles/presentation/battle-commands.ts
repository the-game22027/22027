import { z } from 'zod';
import { GAME_TYPES } from '@modules/question-bank';

/** Payloads of client commands (WEBSOCKET.md §3), checked before anything reaches the engine. */
const clientMsgId = z.string().min(1).max(64);
const battleId = z.uuid();
const roundNo = z.number().int().positive();

export const joinMatchmakingCommand = z.object({ clientMsgId, gameType: z.enum(GAME_TYPES) });
export const leaveMatchmakingCommand = z.object({ clientMsgId });
export const readyCommand = z.object({ clientMsgId, battleId });
export const buzzCommand = z.object({ clientMsgId, battleId, roundNo });
export const answerCommand = z.object({
  clientMsgId,
  battleId,
  roundNo,
  answer: z.union([z.strictObject({ entityId: z.string().min(1).max(64) }), z.strictObject({ number: z.number() })]),
});
export const timeSyncCommand = z.object({ t0: z.number() });
