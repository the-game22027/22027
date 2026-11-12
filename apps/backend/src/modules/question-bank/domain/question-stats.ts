/** One round of `BattleCompleted.questionResults`, as question-bank reads it (08 §5.7). */
export interface RoundResultForStats {
  questionId: string;
  served: boolean;
  solved: boolean;
  wrongAnswers: number;
  stepsRevealed: number | null;
}

/** What one battle adds to a question's stats. */
export interface QuestionStatsIncrement {
  questionId: string;
  timesServed: number;
  timesSolved: number;
  wrongAnswers: number;
  stepsToSolve: number;
}

/** Rounds that never started add nothing; steps count only when a human solved the question. */
export function listQuestionStatsIncrements(results: readonly RoundResultForStats[]): QuestionStatsIncrement[] {
  return results
    .filter((result) => result.served)
    .map((result) => ({
      questionId: result.questionId,
      timesServed: 1,
      timesSolved: result.solved ? 1 : 0,
      wrongAnswers: result.wrongAnswers,
      stepsToSolve: result.solved ? (result.stepsRevealed ?? 0) : 0,
    }));
}
