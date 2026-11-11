import type { GameType } from '@modules/question-bank';
import type { Locale } from '@shared/kernel';
import type { BattleConfigSnapshot } from '../battle-settings';
import type { Placement } from '../../domain/placements';
import type { RoundAction, RoundResult } from '../../domain/games/game-rules';

export const BATTLE_REPOSITORY = Symbol('BATTLE_REPOSITORY');

export interface NewParticipant {
  id: string;
  kind: 'HUMAN' | 'BOT';
  userId: string | null;
  botProfile: string | null;
  botDisplay: { en: string; ar: string } | null;
  locale: Locale;
  seat: number;
  /** Bots are ready at once. */
  readyAt: Date | null;
}

export interface NewBattle {
  id: string;
  mode: 'MATCHMAKING';
  gameType: GameType;
  hasBot: boolean;
  config: BattleConfigSnapshot;
  createdAt: Date;
  readyDeadlineAt: Date;
  participants: NewParticipant[];
  /** One content id per round, in play order. */
  questionIds: string[];
}

export interface BattleCompletion {
  battleId: string;
  endedAt: Date;
  endReason: 'COMPLETED';
  placements: Placement[];
}

/** Persistence of every battle transition (03 §4.3). The engine is the referee; these rows are the history. */
export interface BattleRepository {
  createBattle(battle: NewBattle): Promise<void>;
  markParticipantReady(participantId: string, at: Date): Promise<void>;
  markBattleStarted(battleId: string, at: Date): Promise<void>;
  markRoundStarted(battleId: string, roundNo: number, at: Date): Promise<void>;
  recordRoundAction(
    battleId: string,
    roundNo: number,
    actionNo: number,
    action: RoundAction,
    clientMsgId: string | null,
  ): Promise<void>;
  closeRound(battleId: string, roundNo: number, result: RoundResult, closedAt: Date): Promise<void>;
  /** Writes scores, placements and the BattleCompleted outbox event in one transaction. */
  completeBattle(completion: BattleCompletion): Promise<void>;
  cancelBattle(battleId: string, at: Date, endReason: 'CANCELLED'): Promise<void>;
  /** After a restart nothing runs the unfinished battles any more (WEBSOCKET.md §6.5). Returns their human players. */
  abandonUnfinishedBattles(at: Date): Promise<{ battleIds: string[]; userIds: string[] }>;
  /** Content of the user's last `battleCount` battles (DEC-44). */
  findRecentlyPlayedQuestionIds(userId: string, battleCount: number): Promise<string[]>;
}
