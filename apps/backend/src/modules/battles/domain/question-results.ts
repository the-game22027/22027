/** A finished battle's round, as the history stores it. */
export interface PlayedRound {
  roundNo: number;
  questionId: string;
  startedAt: Date | null;
  endReason: string | null;
  winnerParticipantId: string | null;
  stepsRevealed: number | null;
  actions: { participantId: string; kind: string; isCorrect: boolean | null }[];
}

/** One round of `BattleCompleted.questionResults` (08 §5.7). */
export interface QuestionResult {
  roundNo: number;
  questionId: string;
  endReason: string | null;
  served: boolean;
  solved: boolean;
  wrongAnswers: number;
  stepsRevealed: number | null;
}

const ANSWERING_ACTIONS = new Set(['ANSWER', 'GRID_CLAIM', 'MINE_ANSWER', 'AUCTION_ANSWER']);

/**
 * What a round says about its question, counting humans only: a bot's answers come from its profile,
 * not from knowing football, so they would skew difficulty calibration.
 */
export function summarizeRoundForQuestionStats(round: PlayedRound, humanIds: ReadonlySet<string>): QuestionResult {
  return {
    roundNo: round.roundNo,
    questionId: round.questionId,
    endReason: round.endReason,
    served: round.startedAt !== null,
    solved: round.winnerParticipantId !== null && humanIds.has(round.winnerParticipantId),
    wrongAnswers: round.actions.filter(
      (action) =>
        humanIds.has(action.participantId) && ANSWERING_ACTIONS.has(action.kind) && action.isCorrect === false,
    ).length,
    stepsRevealed: round.stepsRevealed,
  };
}
