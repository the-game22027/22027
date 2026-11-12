/**
 * Pairs waiting players oldest first, never two who blocked each other (03 §7.1). Each ticket is paired with
 * the oldest one after it that it may play; whoever finds nobody stays in the queue.
 */
export function pairTicketsAvoidingBlockedPlayers<T extends { userId: string }>(
  ticketsOldestFirst: readonly T[],
  blockedPairs: readonly (readonly [string, string])[],
): { pairs: [T, T][]; leftovers: T[] } {
  const blocked = new Set(blockedPairs.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const paired = new Set<number>();
  const pairs: [T, T][] = [];
  ticketsOldestFirst.forEach((ticket, index) => {
    if (paired.has(index)) return;
    const partner = ticketsOldestFirst.findIndex(
      (other, otherIndex) =>
        otherIndex > index && !paired.has(otherIndex) && !blocked.has(`${ticket.userId}|${other.userId}`),
    );
    if (partner === -1) return;
    paired.add(index).add(partner);
    pairs.push([ticket, ticketsOldestFirst[partner]]);
  });
  return { pairs, leftovers: ticketsOldestFirst.filter((_, index) => !paired.has(index)) };
}
