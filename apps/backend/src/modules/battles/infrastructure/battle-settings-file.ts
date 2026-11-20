import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { BattleSettings } from '../application/battle-settings';
import { ONE_TWO_PASS_TYPES } from '../domain/games/one-two-rules';

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

const delayRange = z
  .strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
  .refine((range) => range.min <= range.max, 'min > max');

// Checked against `firstMover` for every game type in settingsSchema (zod cannot extend a refined object).
const firstMoverFields = {
  firstMover: z.enum(['RPS', 'RANDOM', 'NONE']),
  firstMoverAfterRound1: z.enum(['ALTERNATE', 'LOSER_STARTS', 'RPS_EACH_ROUND']).optional(),
  rps: z
    .strictObject({
      pickMs: positiveMs,
      maxReplays: z.number().int().nonnegative(),
      revealMs: z.number().int().nonnegative(),
      botPickDelayMs: delayRange,
    })
    .optional(),
};

const revealGame = z.strictObject({
  ...firstMoverFields,
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
  }),
});

const gridGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  turnMs: positiveMs,
  attemptsPerTurn: z.number().int().positive(),
  skipsPerRound: z.number().int().nonnegative().nullable(),
  maxTurns: z.number().int().positive(),
  minAnswersPerCell: z.number().int().positive(),
  revealAnswersAtEnd: z.boolean(),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({ roundWin: z.number().int(), roundDraw: z.number().int(), perCell: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const minesGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  burying: z.strictObject({
    minesPerPlayer: z.number().int().positive(),
    ms: positiveMs,
    maxWrongTries: z.number().int().nonnegative(),
  }),
  turnMs: positiveMs,
  maxTurns: z.number().int().positive(),
  hearts: z.number().int().positive(),
  ownMine: z.enum(['REJECT', 'COSTS_HEART']),
  detector: z.strictObject({ usesPerBattle: z.number().int().nonnegative(), costMs: z.number().int().nonnegative() }),
  revealAnswersAtEnd: z.number().int().nonnegative(),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({ roundWin: z.number().int(), roundDraw: z.number().int(), perSafeAnswer: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const auctionGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  targetScore: z.number().int().positive(),
  pickMs: positiveMs,
  bidding: z.strictObject({ turnMs: positiveMs, minOpeningBid: z.number().int().positive() }),
  proof: z.strictObject({ ms: positiveMs, maxWrong: z.number().int().positive() }),
  allIn: z.strictObject({ maxWrong: z.number().int().positive() }),
  steal: z.strictObject({ ms: positiveMs, names: z.number().int().positive() }),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({ roundWin: z.number().int(), allInWin: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const hexGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  targetScore: z.number().int().positive(),
  pickMs: positiveMs,
  answerMs: positiveMs,
  lockoutMs: z.array(z.number().int().nonnegative()).min(1),
  clear: z.strictObject({ usesPerBattle: z.number().int().nonnegative() }),
  maxPicks: z.number().int().positive(),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({ boardWin: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const vaultGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  targetScore: z.number().int().positive(),
  roundMs: positiveMs,
  lockoutMs: z.array(z.number().int().nonnegative()).min(1),
  leaks: z.strictObject({ firstAtMs: positiveMs, everyMs: positiveMs, max: z.number().int().nonnegative() }),
  points: z.strictObject({ vaultOpened: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const lineupGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  roundMs: positiveMs,
  lockoutMs: z.array(z.number().int().nonnegative()).min(1),
  hints: z.strictObject({
    firstAtMs: positiveMs,
    everyMs: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
  accuse: z.strictObject({ perPlayer: z.number().int().nonnegative() }),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({
    correct: z.number().int(),
    captain: z.number().int(),
    accuseRight: z.number().int(),
    accuseWrong: z.number().int(),
  }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const oneTwoGame = z.strictObject({
  ...firstMoverFields,
  enabled: z.boolean(),
  roundCount: z.number().int().positive(),
  targetScore: z.number().int().positive(),
  pickMs: positiveMs,
  answerMs: positiveMs,
  offerCount: z.number().int().positive(),
  minAnswers: z.number().int().positive(),
  maxPasses: z.number().int().positive(),
  passTypes: z.array(z.enum(ONE_TWO_PASS_TYPES)).min(1),
  showWrongAnswers: z.boolean(),
  points: z.strictObject({ rallyWin: z.number().int() }),
  selection: z.strictObject({
    difficulties: z.array(z.number().int().min(1).max(5)).min(1).nullable(),
  }),
});

const answers = z.strictObject({
  maxLength: z.number().int().positive(),
  typoTolerance: z
    .array(z.strictObject({ fromLetters: z.number().int().nonnegative(), edits: z.number().int().nonnegative() }))
    .min(1)
    .refine(
      (steps) => steps.every((step, index) => index === 0 || step.fromLetters > steps[index - 1].fromLetters),
      'steps must go up by fromLetters',
    ),
  singleWordMaxSharedBy: z.number().int().positive(),
});

const settingsSchema = z
  .strictObject({
    devOnly: z.boolean(),
    engine: z.strictObject({
      readyTimeoutMs: positiveMs,
      latencyGraceMs: z.number().int().nonnegative(),
      betweenRoundsMs: z.number().int().nonnegative(),
      reconnectGraceMs: positiveMs,
    }),
    matchmaking: z.strictObject({
      botFallbackAfterMs: z.number().int().nonnegative(),
      tickMs: positiveMs,
      queueDisconnectGraceMs: z.number().int().nonnegative(),
    }),
    bots: z.strictObject({
      profiles: z.record(z.string(), botProfile).refine((p) => Object.keys(p).length > 0, 'at least one'),
    }),
    answers,
    gameTypes: z.strictObject({
      BUZZER: revealGame.optional(),
      CAREER: revealGame.extend({ showYears: z.boolean() }).optional(),
      WHO_IS_PLAYER: revealGame.optional(),
      GRID: gridGame.optional(),
      MINES: minesGame.optional(),
      AUCTION: auctionGame.optional(),
      VAULT: vaultGame.optional(),
      HEX: hexGame.optional(),
      LINEUP: lineupGame.optional(),
      ONE_TWO: oneTwoGame.optional(),
    }),
  })
  .superRefine((settings, context) => {
    for (const [gameType, game] of Object.entries(settings.gameTypes)) {
      if (!game) continue;
      if (game.firstMover === 'RPS' && !game.rps) {
        context.addIssue({
          code: 'custom',
          path: ['gameTypes', gameType, 'rps'],
          message: 'required when firstMover is RPS',
        });
      }
      if (game.firstMover !== 'NONE' && !game.firstMoverAfterRound1) {
        context.addIssue({
          code: 'custom',
          path: ['gameTypes', gameType, 'firstMoverAfterRound1'],
          message: 'required unless firstMover is NONE',
        });
      }
      if (game.firstMoverAfterRound1 === 'RPS_EACH_ROUND' && game.firstMover !== 'RPS') {
        context.addIssue({
          code: 'custom',
          path: ['gameTypes', gameType, 'firstMoverAfterRound1'],
          message: 'RPS_EACH_ROUND needs firstMover RPS',
        });
      }
    }
  });

export class InvalidBattleSettingsError extends Error {}

/** Reads and checks the battle config file (ADR-0018). Throws at boot: a bad file must not start the API. */
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
      `Battle config ${path} holds placeholder values ("devOnly": true); production needs a reviewed config (ADR-0018).`,
    );
  }
  return result.data;
}
