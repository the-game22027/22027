import type { ParticipantId } from '../games/game-rules';

/** How a game type picks who moves first (08 §9.1). NONE: everyone plays at once. */
export type FirstMoverMethod = 'RPS' | 'RANDOM' | 'NONE';

/** Who starts rounds 2 and later (DEC-71, Pending: config per game type). */
export type FirstMoverAfterRound1 = 'ALTERNATE' | 'LOSER_STARTS' | 'RPS_EACH_ROUND';

/** One first-mover decision, stored on battles.first_mover so the start of every round can be audited. */
export interface FirstMoverOutcome {
  beforeRound: number;
  winnerId: ParticipantId;
  decidedBy: 'RPS' | 'DRAW' | 'RANDOM' | 'ALTERNATE' | 'LOSER_STARTS';
  /** Rock-paper-scissors only: every throw, ties included. */
  attempts?: { attempt: number; picks: { participantId: ParticipantId; choice: string; auto: boolean }[] }[];
}

/**
 * The first mover of the next round, for ALTERNATE and LOSER_STARTS. `seatOrder` lists every participant by seat,
 * those who left included, so the turn passes on from where it was; only `active` participants can be chosen.
 */
export function chooseNextFirstMover(
  rule: 'ALTERNATE' | 'LOSER_STARTS',
  seatOrder: readonly ParticipantId[],
  active: readonly ParticipantId[],
  previousFirstMover: ParticipantId,
  lastRoundWinner: ParticipantId | null,
): ParticipantId {
  // TODO(DEC-70): with 3 or more players "the loser" is not one person, so the turn simply passes on.
  if (rule === 'LOSER_STARTS' && lastRoundWinner && active.length === 2 && active.includes(lastRoundWinner)) {
    return active.find((participant) => participant !== lastRoundWinner) ?? lastRoundWinner;
  }
  const start = seatOrder.indexOf(previousFirstMover);
  for (let step = 1; step <= seatOrder.length; step += 1) {
    const candidate = seatOrder[(start + step) % seatOrder.length];
    if (active.includes(candidate)) return candidate;
  }
  return active[0];
}
