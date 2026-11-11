import { type RandomSource, randomIntegerBetween } from '../random-source';

/** One bot profile from the battle config (DEC-43). Every number is configuration. */
export interface BotProfile {
  displayNames: { en: string; ar: string };
  /** Chance that the bot knows the answer, for difficulties 1 to 5. */
  knowsAnswerByDifficulty: [number, number, number, number, number];
  /** Chance that a bot that does not know buzzes anyway and answers wrong. */
  guessChance: number;
  /** When the bot buzzes, as a share of the steps: 0.5 means after half of them are revealed. */
  buzzAtShareOfSteps: { min: number; max: number };
  /** How long after the planned step is revealed the bot presses the buzzer. */
  reactionDelayMs: { min: number; max: number };
  /** How long the bot "types" after buzzing. */
  typingDelayMs: { min: number; max: number };
}

export interface BotRoundPlan {
  /** Buzz once this step is revealed; null means the bot stays quiet this round. */
  buzzAfterStep: number | null;
  answersCorrectly: boolean;
  typingDelayMs: number;
}

/** What a bot will do in one reveal-and-buzz round (08 §3.3), decided at round start. */
export function planBotRound(
  profile: BotProfile,
  difficulty: number,
  stepCount: number,
  random: RandomSource,
): BotRoundPlan {
  const knowChance = profile.knowsAnswerByDifficulty[Math.min(Math.max(difficulty, 1), 5) - 1];
  const knows = random.next() < knowChance;
  const guesses = !knows && random.next() < profile.guessChance;
  const share =
    profile.buzzAtShareOfSteps.min + random.next() * (profile.buzzAtShareOfSteps.max - profile.buzzAtShareOfSteps.min);
  const typingDelayMs = randomIntegerBetween(random, profile.typingDelayMs.min, profile.typingDelayMs.max);
  return {
    buzzAfterStep: knows || guesses ? Math.min(stepCount, Math.max(1, Math.ceil(share * stepCount))) : null,
    answersCorrectly: knows,
    typingDelayMs,
  };
}
