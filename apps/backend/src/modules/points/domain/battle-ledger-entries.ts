/** The categories of the ledger and the games a rule set can score (02 §2 `game_type`). */
export type ScoredGame = 'PREDICTION' | 'MOTM' | 'BATTLE';

/** What the points module reads from a `BattleCompleted` event (01 §6). */
export interface CompletedBattle {
  battleId: string;
  mode: 'MATCHMAKING' | 'ROOM';
  gameType: string;
  hasBot: boolean;
  roomId: string | null;
  endedAt: Date;
  /** The BATTLE rule set the battle computed its points with; null when none was active. */
  ruleSetId: string | null;
  participants: { participantId: string; kind: 'HUMAN' | 'BOT'; userId: string | null; points: number }[];
}

export interface NewPointEntry {
  userId: string;
  category: ScoredGame;
  sourceType: 'BATTLE_PARTICIPANT';
  /** The battle participant id: one entry per player per battle. */
  sourceId: string;
  ruleSetId: string;
  points: number;
  occurredAt: Date;
  context: { battleId: string; battleMode: string; gameType: string; hasBot: boolean; roomId: string | null };
}

/**
 * The ledger entries of a finished battle (02 §4.9): one per human who earned points. Bots never get
 * entries, and entries of 0 points are not written.
 */
export function listLedgerEntriesOfBattle(battle: CompletedBattle): NewPointEntry[] {
  const earners = battle.participants.flatMap(({ participantId, kind, userId, points }) =>
    kind === 'HUMAN' && userId !== null && points > 0 ? [{ participantId, userId, points }] : [],
  );
  if (earners.length === 0) return [];
  const { ruleSetId } = battle;
  if (ruleSetId === null) throw new Error(`Battle ${battle.battleId} gave points without a rule set`);
  return earners.map(({ participantId, userId, points }) => ({
    userId,
    category: 'BATTLE',
    sourceType: 'BATTLE_PARTICIPANT',
    sourceId: participantId,
    ruleSetId,
    points,
    occurredAt: battle.endedAt,
    context: {
      battleId: battle.battleId,
      battleMode: battle.mode,
      gameType: battle.gameType,
      hasBot: battle.hasBot,
      roomId: battle.roomId,
    },
  }));
}
