import type { GameType } from '@modules/question-bank';
import type { Locale } from '@shared/kernel';
import type { BattleConfigSnapshot } from '../battle-settings';
import type { Placement } from '../../domain/placements';
import type { RoundAction, RoundResult } from '../../domain/games/game-rules';
import type { FirstMoverOutcome } from '../../domain/first-mover/next-first-mover';

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
  ruleSetId: string | null;
  createdAt: Date;
  readyDeadlineAt: Date;
  participants: NewParticipant[];
  /** One content id per round, in play order. */
  questionIds: string[];
}

export interface BattleCompletion {
  battleId: string;
  endedAt: Date;
  endReason: 'COMPLETED' | 'FORFEIT';
  placements: Placement[];
  /** Per participant: what the battle adds to the BATTLES leaderboards (08 §6.1). */
  leaderboardPoints: Record<string, number>;
}

/** Persistence of every battle transition (03 §4.3). The engine is the referee; these rows are the history. */
export interface BattleRepository {
  createBattle(battle: NewBattle): Promise<void>;
  markParticipantReady(participantId: string, at: Date): Promise<void>;
  markBattleStarted(battleId: string, at: Date): Promise<void>;
  markRoundStarted(battleId: string, roundNo: number, at: Date): Promise<void>;
  /** Replaces battles.first_mover with every first-mover decision so far (08 §9.1). */
  saveFirstMoverOutcomes(battleId: string, outcomes: readonly FirstMoverOutcome[]): Promise<void>;
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
  /** No human is left in a running battle (03 §4.3 step 8): no points for anyone (DEC-33). */
  abandonBattle(battleId: string, at: Date): Promise<void>;
  /** null clears it (the player is back). */
  markParticipantDisconnected(participantId: string, at: Date | null): Promise<void>;
  markParticipantForfeited(participantId: string, at: Date): Promise<void>;
  /** After a restart nothing runs the unfinished battles any more (WEBSOCKET.md §6.5). Returns their human players. */
  abandonUnfinishedBattles(at: Date): Promise<{ battleIds: string[]; userIds: string[] }>;
  /** Content of the user's last `battleCount` battles (DEC-44). */
  findRecentlyPlayedQuestionIds(userId: string, battleCount: number): Promise<string[]>;
  /** A round with this question started in a battle the user took part in (08 §5.7). */
  wasQuestionServedToUser(questionId: string, userId: string): Promise<boolean>;
}
