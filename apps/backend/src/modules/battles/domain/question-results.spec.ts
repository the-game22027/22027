import { type PlayedRound, summarizeRoundForQuestionStats } from './question-results';

const humans = new Set(['human']);
const round = (overrides: Partial<PlayedRound>): PlayedRound => ({
  roundNo: 1,
  questionId: 'q',
  startedAt: new Date('2026-11-12T10:00:00Z'),
  endReason: 'CORRECT',
  winnerParticipantId: 'human',
  stepsRevealed: 3,
  actions: [],
  ...overrides,
});

describe('summarizeRoundForQuestionStats', () => {
  it('counts a round a human won as solved, with their wrong answers and claims', () => {
    const result = summarizeRoundForQuestionStats(
      round({
        actions: [
          { participantId: 'human', kind: 'BUZZ', isCorrect: null },
          { participantId: 'human', kind: 'ANSWER', isCorrect: false },
          { participantId: 'human', kind: 'GRID_CLAIM', isCorrect: false },
          { participantId: 'human', kind: 'ANSWER', isCorrect: true },
        ],
      }),
      humans,
    );
    expect(result).toEqual({
      roundNo: 1,
      questionId: 'q',
      endReason: 'CORRECT',
      served: true,
      solved: true,
      wrongAnswers: 2,
      stepsRevealed: 3,
    });
  });

  it('leaves bots out: a bot win is not solved, a bot miss is not a wrong answer', () => {
    const result = summarizeRoundForQuestionStats(
      round({ winnerParticipantId: 'bot', actions: [{ participantId: 'bot', kind: 'ANSWER', isCorrect: false }] }),
      humans,
    );
    expect(result).toMatchObject({ solved: false, wrongAnswers: 0 });
  });

  it('counts wrong vault tries, hex names, lineup names and lineup accusations, but not picks', () => {
    const result = summarizeRoundForQuestionStats(
      round({
        winnerParticipantId: null,
        actions: [
          { participantId: 'human', kind: 'VAULT_TRY', isCorrect: false },
          { participantId: 'human', kind: 'HEX_PICK', isCorrect: null },
          { participantId: 'human', kind: 'HEX_ANSWER', isCorrect: false },
          { participantId: 'human', kind: 'LINEUP_ANSWER', isCorrect: false },
          { participantId: 'human', kind: 'LINEUP_ANSWER', isCorrect: true },
          { participantId: 'human', kind: 'LINEUP_ACCUSE', isCorrect: false },
        ],
      }),
      humans,
    );
    expect(result.wrongAnswers).toBe(4);
  });

  it('marks a round that never started as not served', () => {
    expect(summarizeRoundForQuestionStats(round({ startedAt: null, winnerParticipantId: null }), humans)).toMatchObject(
      {
        served: false,
        solved: false,
      },
    );
  });
});
