import type { ParticipantId } from '../games/game-rules';
import type { RandomSource } from '../random-source';

/** Who moves first in a two-player battle, decided by rock-paper-scissors (08 §9.1, ADR-0023). */

export const ROCK_PAPER_SCISSORS_CHOICES = ['ROCK', 'PAPER', 'SCISSORS'] as const;
export type RockPaperScissorsChoice = (typeof ROCK_PAPER_SCISSORS_CHOICES)[number];

const BEATS: Record<RockPaperScissorsChoice, RockPaperScissorsChoice> = {
  ROCK: 'SCISSORS',
  PAPER: 'ROCK',
  SCISSORS: 'PAPER',
};

export interface RockPaperScissorsPick {
  participantId: ParticipantId;
  choice: RockPaperScissorsChoice;
  /** The server picked for a player who did not pick in time. */
  auto: boolean;
}

export interface RockPaperScissorsAttempt {
  attempt: number;
  picks: RockPaperScissorsPick[];
  /** null for a tie. */
  winnerId: ParticipantId | null;
}

export interface RockPaperScissorsDuel {
  players: readonly [ParticipantId, ParticipantId];
  /** 1-based; attempt 1 plus up to `maxReplays` replays. */
  attempt: number;
  maxReplays: number;
  picks: RockPaperScissorsPick[];
  closedAttempts: RockPaperScissorsAttempt[];
}

export interface DuelDecision {
  winnerId: ParticipantId;
  /** DRAW: every attempt was a tie, so the seeded random source chose. */
  decidedBy: 'RPS' | 'DRAW';
}

export function startRockPaperScissorsDuel(
  players: readonly [ParticipantId, ParticipantId],
  maxReplays: number,
): RockPaperScissorsDuel {
  return { players, attempt: 1, maxReplays, picks: [], closedAttempts: [] };
}

/** The ack's error code when this pick cannot be taken, otherwise null. */
export function findPickRejection(duel: RockPaperScissorsDuel, from: ParticipantId, attempt: number): string | null {
  if (!duel.players.includes(from)) return 'NOT_PARTICIPANT';
  if (attempt !== duel.attempt) return 'ATTEMPT_NOT_CURRENT';
  if (duel.picks.some((pick) => pick.participantId === from)) return 'ALREADY_PICKED';
  return null;
}

export function addPick(
  duel: RockPaperScissorsDuel,
  from: ParticipantId,
  choice: RockPaperScissorsChoice,
): RockPaperScissorsDuel {
  return { ...duel, picks: [...duel.picks, { participantId: from, choice, auto: false }] };
}

export function hasEveryonePicked(duel: RockPaperScissorsDuel): boolean {
  return duel.players.every((player) => duel.picks.some((pick) => pick.participantId === player));
}

export function drawRandomChoice(random: RandomSource): RockPaperScissorsChoice {
  return ROCK_PAPER_SCISSORS_CHOICES[Math.floor(random.next() * ROCK_PAPER_SCISSORS_CHOICES.length)];
}

/** The winner of one throw, or null for a tie. */
export function findThrowWinner(first: RockPaperScissorsPick, second: RockPaperScissorsPick): ParticipantId | null {
  if (first.choice === second.choice) return null;
  return BEATS[first.choice] === second.choice ? first.participantId : second.participantId;
}

/**
 * Ends the current attempt: a player who did not pick gets a random pick marked `auto`. A tie with replays left
 * opens the next attempt; a tie after the last replay is decided by the seeded random source.
 */
export function closeAttempt(
  duel: RockPaperScissorsDuel,
  random: RandomSource,
): { duel: RockPaperScissorsDuel; closed: RockPaperScissorsAttempt; decision: DuelDecision | null } {
  const picks = duel.players.map(
    (player) =>
      duel.picks.find((pick) => pick.participantId === player) ?? {
        participantId: player,
        choice: drawRandomChoice(random),
        auto: true,
      },
  );
  const winnerId = findThrowWinner(picks[0], picks[1]);
  const closed: RockPaperScissorsAttempt = { attempt: duel.attempt, picks, winnerId };
  const closedAttempts = [...duel.closedAttempts, closed];
  if (winnerId) {
    return { duel: { ...duel, picks: [], closedAttempts }, closed, decision: { winnerId, decidedBy: 'RPS' } };
  }
  if (duel.attempt <= duel.maxReplays) {
    return { duel: { ...duel, attempt: duel.attempt + 1, picks: [], closedAttempts }, closed, decision: null };
  }
  const drawn = duel.players[Math.floor(random.next() * duel.players.length)];
  return { duel: { ...duel, picks: [], closedAttempts }, closed, decision: { winnerId: drawn, decidedBy: 'DRAW' } };
}
