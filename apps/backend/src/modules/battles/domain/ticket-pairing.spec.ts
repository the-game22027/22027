import { pairTicketsAvoidingBlockedPlayers } from './ticket-pairing';

const tickets = (...userIds: string[]) => userIds.map((userId) => ({ userId }));
const userIdsOf = (pairs: { userId: string }[][]) => pairs.map((pair) => pair.map((ticket) => ticket.userId));

describe('pairTicketsAvoidingBlockedPlayers', () => {
  it('pairs the oldest first when nobody is blocked', () => {
    const { pairs, leftovers } = pairTicketsAvoidingBlockedPlayers(tickets('a', 'b', 'c'), []);
    expect(userIdsOf(pairs)).toEqual([['a', 'b']]);
    expect(leftovers.map((ticket) => ticket.userId)).toEqual(['c']);
  });

  it('skips a blocked pair, in either direction, and pairs each with the next player', () => {
    const { pairs } = pairTicketsAvoidingBlockedPlayers(tickets('a', 'b', 'c', 'd'), [['b', 'a']]);
    expect(userIdsOf(pairs)).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });

  it('leaves two players who blocked each other in the queue', () => {
    const { pairs, leftovers } = pairTicketsAvoidingBlockedPlayers(tickets('a', 'b'), [['a', 'b']]);
    expect(pairs).toEqual([]);
    expect(leftovers.map((ticket) => ticket.userId)).toEqual(['a', 'b']);
  });
});
