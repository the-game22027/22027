import type { ParticipantId } from './games/game-rules';

export interface Placement {
  participantId: ParticipantId;
  score: number;
  /** 1 = best. Equal scores share a placement, and the next placement skips (1, 1, 3). */
  placement: number;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
}

/**
 * Placements from final scores (DEC-33: ties share a placement). Sole first place wins, a shared first
 * place is a draw for those who share it, everyone else loses.
 */
export function placeParticipantsByScore(scores: ReadonlyMap<ParticipantId, number>): Placement[] {
  const ordered = [...scores].sort(([, a], [, b]) => b - a);
  const topScore = ordered[0]?.[1];
  const sharingTop = ordered.filter(([, score]) => score === topScore).length;
  return ordered.map(([participantId, score]) => {
    const placement = 1 + ordered.filter(([, other]) => other > score).length;
    const outcome = placement > 1 ? 'LOSS' : sharingTop > 1 ? 'DRAW' : 'WIN';
    return { participantId, score, placement, outcome };
  });
}
