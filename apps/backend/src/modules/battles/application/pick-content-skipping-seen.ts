import type { ContentFilter, ContentSelector } from '@modules/question-bank';

export interface PickedContent {
  contentIds: string[];
  /** How many of `contentIds` (at the end) the players had seen before: the bank was short. */
  repeatedCount: number;
}

/**
 * DEC-44: questions none of the players has seen, at random. When the bank cannot fill the battle, the
 * missing rounds are the seen questions they saw longest ago, played after the fresh ones.
 */
export async function pickContentSkippingSeen(
  selector: Pick<ContentSelector, 'pickContentIds' | 'pickContentIdsInGivenOrder'>,
  filter: ContentFilter,
  seenContentIdsMostRecentFirst: readonly string[],
): Promise<PickedContent> {
  const fresh = await selector.pickContentIds({ ...filter, excludeContentIds: seenContentIdsMostRecentFirst });
  const missing = filter.count - fresh.length;
  if (missing === 0 || seenContentIdsMostRecentFirst.length === 0) return { contentIds: fresh, repeatedCount: 0 };
  const repeated = await selector.pickContentIdsInGivenOrder(
    { ...filter, count: missing },
    [...seenContentIdsMostRecentFirst].reverse(),
  );
  return { contentIds: [...fresh, ...repeated], repeatedCount: repeated.length };
}
