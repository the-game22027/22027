import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { BattleSettings } from '../application/battle-settings';

const positiveMs = z.number().int().positive();
const share = z.number().min(0).max(1);

const botProfile = z.strictObject({
  displayNames: z.strictObject({ en: z.string().min(1), ar: z.string().min(1) }),
  knowsAnswerByDifficulty: z.tuple([share, share, share, share, share]),
  guessChance: share,
  buzzAtShareOfSteps: z.strictObject({ min: share, max: share }).refine((range) => range.min <= range.max, 'min > max'),
  reactionDelayMs: z
    .strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
    .refine((range) => range.min <= range.max, 'min > max'),
  typingDelayMs: z
    .strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
    .refine((range) => range.min <= range.max, 'min > max'),
});

const revealGame = z.strictObject({
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  revealIntervalMs: positiveMs,
  resumeDelayMs: z.number().int().nonnegative(),
  answerWindowMs: positiveMs,
  finalWindowMs: positiveMs,
  attemptsPerPlayer: z.number().int().positive(),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({ correct: z.number().int(), perUnrevealedStep: z.number().int(), wrong: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
    excludeLastBattles: z.number().int().nonnegative(),
  }),
});

const settingsSchema = z.strictObject({
  devOnly: z.boolean(),
  engine: z.strictObject({
    readyTimeoutMs: positiveMs,
    latencyGraceMs: z.number().int().nonnegative(),
    betweenRoundsMs: z.number().int().nonnegative(),
  }),
  matchmaking: z.strictObject({ botFallbackAfterMs: z.number().int().nonnegative() }),
  bots: z.strictObject({
    profiles: z.record(z.string(), botProfile).refine((p) => Object.keys(p).length > 0, 'at least one'),
  }),
  gameTypes: z.strictObject({ BUZZER: revealGame.optional() }),
});

export class InvalidBattleSettingsError extends Error {}

/** Reads and checks the battle config file (ADR-0017). Throws at boot: a bad file must not start the API. */
export function loadBattleSettingsFile(path: string, isProduction: boolean): BattleSettings {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new InvalidBattleSettingsError(`Battle config ${path} could not be read: ${(error as Error).message}`);
  }
  const result = settingsSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new InvalidBattleSettingsError([`Battle config ${path} is invalid:`, ...problems].join('\n'));
  }
  if (isProduction && result.data.devOnly) {
    throw new InvalidBattleSettingsError(
      `Battle config ${path} holds placeholder values ("devOnly": true); production needs a reviewed config (ADR-0017).`,
    );
  }
  return result.data;
}
