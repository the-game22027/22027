import { placeParticipantsByScore } from './placements';

describe('placing participants by score', () => {
  it('gives the highest score the win in a 1v1', () => {
    expect(
      placeParticipantsByScore(
        new Map([
          ['a', 10],
          ['b', 26],
        ]),
      ),
    ).toEqual([
      { participantId: 'b', score: 26, placement: 1, outcome: 'WIN' },
      { participantId: 'a', score: 10, placement: 2, outcome: 'LOSS' },
    ]);
  });

  it('makes an equal score a draw', () => {
    expect(
      placeParticipantsByScore(
        new Map([
          ['a', 5],
          ['b', 5],
        ]),
      ).map((p) => [p.placement, p.outcome]),
    ).toEqual([
      [1, 'DRAW'],
      [1, 'DRAW'],
    ]);
  });

  it('shares placements in a room of four and skips the next one', () => {
    const placed = placeParticipantsByScore(
      new Map([
        ['a', 3],
        ['b', 9],
        ['c', 3],
        ['d', -2],
      ]),
    );
    expect(placed.map((p) => [p.participantId, p.placement, p.outcome])).toEqual([
      ['b', 1, 'WIN'],
      ['a', 2, 'LOSS'],
      ['c', 2, 'LOSS'],
      ['d', 4, 'LOSS'],
    ]);
  });
});
