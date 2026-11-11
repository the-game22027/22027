import { SeededRandom } from '../random-source';
import { type BotProfile, planBotRound } from './reveal-and-buzz-bot';

const profile: BotProfile = {
  displayNames: { en: 'Bot', ar: 'بوت' },
  knowsAnswerByDifficulty: [1, 0.8, 0.5, 0.3, 0],
  guessChance: 0,
  buzzAtShareOfSteps: { min: 0.5, max: 1 },
  reactionDelayMs: { min: 200, max: 600 },
  typingDelayMs: { min: 800, max: 2_000 },
};

describe('planning a bot round', () => {
  it('replays the same plans from the same seed', () => {
    const plans = (seed: number) => {
      const random = new SeededRandom(seed);
      return [1, 2, 3, 4, 5].map((difficulty) => planBotRound(profile, difficulty, 4, random));
    };
    expect(plans(42)).toEqual(plans(42));
    expect(plans(42)).not.toEqual(plans(7));
  });

  it('always knows an easy answer and buzzes within the configured share of the steps', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const plan = planBotRound(profile, 1, 4, new SeededRandom(seed));
      expect(plan.answersCorrectly).toBe(true);
      expect(plan.buzzAfterStep).toBeGreaterThanOrEqual(2);
      expect(plan.buzzAfterStep).toBeLessThanOrEqual(4);
      expect(plan.typingDelayMs).toBeGreaterThanOrEqual(800);
      expect(plan.typingDelayMs).toBeLessThanOrEqual(2_000);
    }
  });

  it('stays quiet when it does not know and never guesses', () => {
    expect(planBotRound(profile, 5, 4, new SeededRandom(1))).toMatchObject({
      buzzAfterStep: null,
      answersCorrectly: false,
    });
  });

  it('buzzes with a wrong answer when it guesses', () => {
    const guesser = { ...profile, guessChance: 1 };
    const plan = planBotRound(guesser, 5, 4, new SeededRandom(1));
    expect(plan.answersCorrectly).toBe(false);
    expect(plan.buzzAfterStep).not.toBeNull();
  });
});
