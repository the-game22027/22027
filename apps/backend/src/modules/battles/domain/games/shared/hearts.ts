import type { ParticipantId } from '../game-rules';

/** Lives per player (08 §9.2). */
export type Hearts = Readonly<Record<ParticipantId, number>>;

export const giveEveryoneHearts = (participants: readonly ParticipantId[], hearts: number): Hearts =>
  Object.fromEntries(participants.map((id) => [id, hearts]));

export const loseHeart = (hearts: Hearts, who: ParticipantId): Hearts => ({
  ...hearts,
  [who]: Math.max(0, (hearts[who] ?? 0) - 1),
});

export const hasHeartsLeft = (hearts: Hearts, who: ParticipantId): boolean => (hearts[who] ?? 0) > 0;
