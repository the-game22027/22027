import { z } from 'zod';
import { GAME_TYPES } from '@modules/question-bank';
import { ROCK_PAPER_SCISSORS_CHOICES } from '../domain/first-mover/rock-paper-scissors-duel';

/** Payloads of client commands (WEBSOCKET.md §3), checked before anything reaches the engine. */
const clientMsgId = z.string().min(1).max(64);
const battleId = z.uuid();
const roundNo = z.number().int().positive();
const answerText = z.string().max(500);

export const joinMatchmakingCommand = z.object({ clientMsgId, gameType: z.enum(GAME_TYPES) });
export const leaveMatchmakingCommand = z.object({ clientMsgId });
export const readyCommand = z.object({ clientMsgId, battleId });
export const rockPaperScissorsPickCommand = z.object({
  clientMsgId,
  battleId,
  attempt: z.number().int().positive(),
  choice: z.enum(ROCK_PAPER_SCISSORS_CHOICES),
});
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
export const auctionPickCommand = z.object({ clientMsgId, battleId, roundNo, list: z.number().int().min(0).max(2) });
export const auctionBidCommand = z.object({ clientMsgId, battleId, roundNo, amount: z.number().int().positive() });
export const auctionCallCommand = z.object({ clientMsgId, battleId, roundNo });
/** The code is checked against the round's digit count by the rules (`INVALID_CODE`). */
export const vaultTryCommand = z.object({ clientMsgId, battleId, roundNo, code: z.string().regex(/^[0-9]{1,9}$/) });
/** `mines:bury`, `mines:answer` and `mines:scan` share one shape (08 §10.3); so does `auction:answer`. */
export const minesTextCommand = z.object({
  clientMsgId,
  battleId,
  roundNo,
  answer: z.strictObject({ text: answerText }),
});
export const resyncCommand = z.object({ clientMsgId, battleId, lastSeq: z.number().int().nonnegative().optional() });
export const forfeitCommand = z.object({ clientMsgId, battleId });
export const timeSyncCommand = z.object({ t0: z.number() });
