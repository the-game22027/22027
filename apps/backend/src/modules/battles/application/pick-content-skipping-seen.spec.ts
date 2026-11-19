import type { ContentFilter, ContentSelectionCriteria } from '@modules/question-bank';
import { pickContentSkippingSeen } from './pick-content-skipping-seen';

describe('pickContentSkippingSeen (DEC-44)', () => {
  const pickContentIds = jest.fn<Promise<string[]>, [ContentSelectionCriteria]>();
  const pickContentIdsInGivenOrder = jest.fn<Promise<string[]>, [ContentFilter, readonly string[]]>();
  const selector = { pickContentIds, pickContentIdsInGivenOrder };
  const filter: ContentFilter = { gameType: 'BUZZER', count: 3, locales: ['ar'] };

  beforeEach(() => {
    pickContentIds.mockReset();
    pickContentIdsInGivenOrder.mockReset();
  });

  it('skips every seen question and stops there when the bank has enough unseen ones', async () => {
    pickContentIds.mockResolvedValue(['a', 'b', 'c']);

    await expect(pickContentSkippingSeen(selector, filter, ['s2', 's1'])).resolves.toEqual({
      contentIds: ['a', 'b', 'c'],
      repeatedCount: 0,
    });
    expect(pickContentIds).toHaveBeenCalledWith({ ...filter, excludeContentIds: ['s2', 's1'] });
    expect(pickContentIdsInGivenOrder).not.toHaveBeenCalled();
  });

  it('fills a short bank with the questions seen longest ago, after the fresh ones', async () => {
    pickContentIds.mockResolvedValue(['a']);
    pickContentIdsInGivenOrder.mockResolvedValue(['s1', 's2']);

    await expect(pickContentSkippingSeen(selector, filter, ['s3', 's2', 's1'])).resolves.toEqual({
      contentIds: ['a', 's1', 's2'],
      repeatedCount: 2,
    });
    expect(pickContentIdsInGivenOrder).toHaveBeenCalledWith({ ...filter, count: 2 }, ['s1', 's2', 's3']);
  });

  it('does not ask for a refill when the players have seen nothing', async () => {
    pickContentIds.mockResolvedValue(['a']);

    await expect(pickContentSkippingSeen(selector, filter, [])).resolves.toEqual({
      contentIds: ['a'],
      repeatedCount: 0,
    });
    expect(pickContentIdsInGivenOrder).not.toHaveBeenCalled();
  });

  it('returns what there is when even the seen questions cannot fill the battle', async () => {
    pickContentIds.mockResolvedValue([]);
    pickContentIdsInGivenOrder.mockResolvedValue(['s1']);

    await expect(pickContentSkippingSeen(selector, filter, ['s1'])).resolves.toEqual({
      contentIds: ['s1'],
      repeatedCount: 1,
    });
  });
});
