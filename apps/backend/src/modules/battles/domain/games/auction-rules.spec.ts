import { SeededRandom } from '../random-source';
import { type AuctionConfig, type AuctionRoundState, AuctionRules, PHASE_TIMER } from './auction-rules';
import { isRejection } from './game-rules';

const config: AuctionConfig = {
  pickMs: 10_000,
  bidTurnMs: 8_000,
  minOpeningBid: 1,
  proofMs: 45_000,
  proofMaxWrong: 3,
  allInMaxWrong: 1,
  stealMs: 10_000,
  stealNames: 1,
  latencyGraceMs: 300,
  showWrongAnswers: true,
  points: { roundWin: 1, allInWin: 2 },
};
const T0 = new Date('2026-11-19T20:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const rules = new AuctionRules(config);
const ok = (result: ReturnType<AuctionRules['handleCommand']>): ReturnType<AuctionRules['startRound']> => {
  if (isRejection(result)) throw new Error(`rejected ${result.code}`);
  return result;
};
const codeOf = (result: ReturnType<AuctionRules['handleCommand']>) => (isRejection(result) ? result.code : null);
const events = (step: ReturnType<AuctionRules['startRound']>) =>
  step.effects.flatMap((effect) => (effect.type === 'EMIT' ? [effect.event] : []));
const endOf = (step: ReturnType<AuctionRules['startRound']>) =>
  step.effects.find((effect) => effect.type === 'END_ROUND');

/** Lists of 9, 12 and 4 names; a picks first. */
const start = (rulesUsed = rules) => rulesUsed.startRound(1, ['a', 'b'], [9, 12, 4], 'a', T0);
const send = (state: AuctionRoundState, who: string, command: Parameters<AuctionRules['handleCommand']>[2], ms = 500) =>
  rules.handleCommand(state, who, command, at(ms));
const say = (state: AuctionRoundState, who: string, entityId: string | null, inList = true, ms = 1_000) =>
  send(state, who, { type: 'AUCTION_ANSWER', answer: { entityId }, inList }, ms);

/** a picks list 0 (9 names), a bids 4, b bids 7, a calls: b must prove 7. */
const proving = () => {
  let state = ok(send(start().state, 'a', { type: 'AUCTION_PICK', list: 0 })).state;
  state = ok(send(state, 'a', { type: 'AUCTION_BID', amount: 4 })).state;
  state = ok(send(state, 'b', { type: 'AUCTION_BID', amount: 7 })).state;
  return ok(send(state, 'a', { type: 'AUCTION_CALL' }));
};

describe('AuctionRules', () => {
  it('starts with the picker and the pick deadline timer', () => {
    const step = start();
    expect(events(step)).toEqual([{ type: 'ROUND_STARTED', roundNo: 1, picker: 'a', pickDeadlineAt: at(10_000) }]);
    expect(step.effects).toContainEqual({ type: 'SCHEDULE', timer: PHASE_TIMER, at: at(10_300) });
  });

  it('only the picker picks, a valid list, in time; then the picker opens the bidding', () => {
    const state = start().state;
    expect(codeOf(send(state, 'b', { type: 'AUCTION_PICK', list: 0 }))).toBe('NOT_YOUR_PICK');
    expect(codeOf(send(state, 'a', { type: 'AUCTION_PICK', list: 3 }))).toBe('INVALID_LIST');
    expect(codeOf(send(state, 'a', { type: 'AUCTION_PICK', list: 0 }, 10_301))).toBe('PICK_WINDOW_CLOSED');
    const step = ok(send(state, 'a', { type: 'AUCTION_PICK', list: 1 }));
    expect(events(step).map((event) => event.type)).toEqual(['PICKED', 'TURN']);
    expect(step.state).toMatchObject({ phase: 'BIDDING', pickedList: 1, turnOf: 'a' });
  });

  it('picks a list at random when the picker runs out of time', () => {
    const step = rules.handleTimer(start().state, PHASE_TIMER, at(10_300), new SeededRandom(4));
    expect(step.state.phase).toBe('BIDDING');
    expect(events(step)[0]).toMatchObject({ type: 'PICKED', auto: true });
  });

  it('bids go up, stay within the list, and only the player on turn bids; a call needs a bid first', () => {
    const state = ok(send(start().state, 'a', { type: 'AUCTION_PICK', list: 0 })).state;
    expect(codeOf(send(state, 'b', { type: 'AUCTION_BID', amount: 3 }))).toBe('NOT_YOUR_TURN');
    expect(codeOf(send(state, 'a', { type: 'AUCTION_CALL' }))).toBe('NOTHING_TO_CALL');
    expect(codeOf(send(state, 'a', { type: 'AUCTION_BID', amount: 0 }))).toBe('BID_TOO_LOW');
    expect(codeOf(send(state, 'a', { type: 'AUCTION_BID', amount: 10 }))).toBe('BID_TOO_HIGH');
    const opened = ok(send(state, 'a', { type: 'AUCTION_BID', amount: 4 })).state;
    expect(opened.turnOf).toBe('b');
    expect(codeOf(send(opened, 'b', { type: 'AUCTION_BID', amount: 4 }))).toBe('BID_TOO_LOW');
  });

  it('a call makes the last bidder prove the bid', () => {
    const step = proving();
    expect(events(step)).toEqual([
      { type: 'PROOF', roundNo: 1, prover: 'b', amount: 7, maxWrong: 3, proofDeadlineAt: at(45_500), reason: 'CALL' },
    ]);
  });

  it('a bid of the whole list is an all-in: the proof starts at once with its own wrong-name limit', () => {
    const state = ok(send(start().state, 'a', { type: 'AUCTION_PICK', list: 2 })).state;
    const step = ok(send(state, 'a', { type: 'AUCTION_BID', amount: 4 }));
    expect(events(step).at(-1)).toMatchObject({ type: 'PROOF', prover: 'a', amount: 4, maxWrong: 1, reason: 'ALL_IN' });
  });

  it("the opener's timeout opens with the minimum bid; a later timeout counts as a call", () => {
    const state = ok(send(start().state, 'a', { type: 'AUCTION_PICK', list: 0 })).state;
    const opened = rules.handleTimer(state, PHASE_TIMER, at(9_000), new SeededRandom(1));
    expect(events(opened)[0]).toMatchObject({ type: 'BID', participantId: 'a', amount: 1 });
    const called = rules.handleTimer(opened.state, PHASE_TIMER, at(18_000), new SeededRandom(1));
    expect(events(called)[0]).toMatchObject({ type: 'PROOF', prover: 'a', amount: 1, reason: 'TIMEOUT' });
  });

  it('enough different right names prove the bid and win the round', () => {
    let state = proving().state;
    for (const name of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) state = ok(say(state, 'b', name)).state;
    const step = ok(say(state, 'b', 'p7'));
    expect(endOf(step)).toEqual({
      type: 'END_ROUND',
      result: { winnerParticipantId: 'b', endReason: 'PROVED', points: { b: 1 }, stepsRevealed: 7 },
    });
  });

  it('a proved all-in is worth more', () => {
    let state = ok(send(start().state, 'a', { type: 'AUCTION_PICK', list: 2 })).state;
    state = ok(send(state, 'a', { type: 'AUCTION_BID', amount: 4 })).state;
    for (const name of ['p1', 'p2', 'p3']) state = ok(say(state, 'a', name)).state;
    expect(endOf(ok(say(state, 'a', 'p4')))).toMatchObject({ result: { points: { a: 2 } } });
  });

  it('wrong and repeated names are strikes; enough strikes are a bust and the other player may steal', () => {
    let state = ok(say(proving().state, 'b', 'p1')).state;
    const repeated = ok(say(state, 'b', 'p1'));
    expect(events(repeated)[0]).toMatchObject({ outcome: 'REPEATED', strikes: 1 });
    state = ok(say(repeated.state, 'b', 'drogba', false)).state;
    const bust = ok(say(state, 'b', 'nobody', false));
    expect(events(bust).at(-1)).toEqual({
      type: 'STEAL',
      roundNo: 1,
      stealer: 'a',
      names: 1,
      stealDeadlineAt: at(11_000),
    });
    expect(codeOf(say(bust.state, 'b', 'p2'))).toBe('NOT_YOUR_TURN');
    expect(codeOf(say(bust.state, 'a', 'p1'))).toBeNull();
    expect(endOf(ok(say(bust.state, 'a', 'p1')))).toMatchObject({
      result: { winnerParticipantId: null, endReason: 'BUST' },
    });
    expect(endOf(ok(say(bust.state, 'a', 'p9')))).toMatchObject({
      result: { winnerParticipantId: 'a', endReason: 'STOLEN' },
    });
  });

  it('running out of time in the proof is a bust; running out in the steal leaves no winner', () => {
    const bust = rules.handleTimer(proving().state, PHASE_TIMER, at(46_000), new SeededRandom(1));
    expect(bust.state).toMatchObject({ phase: 'STEALING', stealer: 'a' });
    const end = rules.handleTimer(bust.state, PHASE_TIMER, at(60_000), new SeededRandom(1));
    expect(endOf(end)).toMatchObject({ result: { winnerParticipantId: null, endReason: 'BUST' } });
  });

  it('hides a wrong name unless showWrongAnswers', () => {
    const hidden = new AuctionRules({ ...config, showWrongAnswers: false });
    let state = ok(hidden.handleCommand(start(hidden).state, 'a', { type: 'AUCTION_PICK', list: 0 }, at(500))).state;
    state = ok(hidden.handleCommand(state, 'a', { type: 'AUCTION_BID', amount: 9 }, at(600))).state;
    const step = ok(
      hidden.handleCommand(
        state,
        'a',
        { type: 'AUCTION_ANSWER', answer: { entityId: 'drogba' }, inList: false },
        at(700),
      ),
    );
    expect(events(step)[0]).toMatchObject({ outcome: 'WRONG', entityId: null });
  });

  it('a forfeit gives the round to the other player without points', () => {
    expect(endOf(rules.participantLeft(proving().state, 'b'))).toMatchObject({
      result: { winnerParticipantId: 'a', endReason: 'FORFEIT', points: {} },
    });
  });
});
