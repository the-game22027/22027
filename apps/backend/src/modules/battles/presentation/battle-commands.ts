import { z } from 'zod';
import { GAME_TYPES } from '@modules/question-bank';

/** Payloads of client commands (WEBSOCKET.md §3), checked before anything reaches the engine. */
const clientMsgId = z.string().min(1).max(64);
const battleId = z.uuid();
const roundNo = z.number().int().positive();
const answerText = z.string().max(500);

export const joinMatchmakingCommand = z.object({ clientMsgId, gameType: z.enum(GAME_TYPES) });
export const leaveMatchmakingCommand = z.object({ clientMsgId });
export const readyCommand = z.object({ clientMsgId, battleId });
export const buzzCommand = z.object({ clientMsgId, battleId, roundNo });
export const answerCommand = z.object({
  clientMsgId,
  battleId,
  roundNo,
  // The length limit that counts is answers.maxLength (EMPTY_ANSWER); this one only bounds the payload.
  answer: z.union([z.strictObject({ text: answerText }), z.strictObject({ number: z.number() })]),
});
export const gridClaimCommand = z.object({
  clientMsgId,
  battleId,
  roundNo,
  cell: z.object({ row: z.number().int().min(0).max(2), col: z.number().int().min(0).max(2) }),
  answer: z.strictObject({ text: answerText }),
});
export const gridSkipCommand = z.object({ clientMsgId, battleId, roundNo });
export const resyncCommand = z.object({ clientMsgId, battleId, lastSeq: z.number().int().nonnegative().optional() });
export const forfeitCommand = z.object({ clientMsgId, battleId });
export const timeSyncCommand = z.object({ t0: z.number() });
