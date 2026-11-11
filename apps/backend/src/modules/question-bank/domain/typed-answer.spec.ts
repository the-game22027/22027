import { judgeTypedAnswer } from './typed-answer';

describe('judging a typed answer', () => {
  it('is correct only for an accepted entity of the round kind', () => {
    expect(judgeTypedAnswer({ entityKind: 'PLAYER', roundAnswerKind: 'PLAYER', isAcceptedForSlot: true })).toBe(
      'CORRECT',
    );
    expect(judgeTypedAnswer({ entityKind: 'PLAYER', roundAnswerKind: 'PLAYER', isAcceptedForSlot: false })).toBe(
      'WRONG',
    );
  });

  it('calls an unknown entity or an entity of another kind unknown, never wrong', () => {
    expect(judgeTypedAnswer({ entityKind: null, roundAnswerKind: 'PLAYER', isAcceptedForSlot: false })).toBe(
      'UNKNOWN_ENTITY',
    );
    expect(judgeTypedAnswer({ entityKind: 'CLUB', roundAnswerKind: 'PLAYER', isAcceptedForSlot: false })).toBe(
      'UNKNOWN_ENTITY',
    );
  });
});
