import { listQuestionStatsIncrements } from './question-stats';

describe('listQuestionStatsIncrements', () => {
  it('adds a served round, with its steps only when it was solved', () => {
    expect(
      listQuestionStatsIncrements([
        { questionId: 'a', served: true, solved: true, wrongAnswers: 1, stepsRevealed: 3 },
        { questionId: 'b', served: true, solved: false, wrongAnswers: 2, stepsRevealed: 6 },
        { questionId: 'c', served: false, solved: false, wrongAnswers: 0, stepsRevealed: null },
      ]),
    ).toEqual([
      { questionId: 'a', timesServed: 1, timesSolved: 1, wrongAnswers: 1, stepsToSolve: 3 },
      { questionId: 'b', timesServed: 1, timesSolved: 0, wrongAnswers: 2, stepsToSolve: 0 },
    ]);
  });
});
