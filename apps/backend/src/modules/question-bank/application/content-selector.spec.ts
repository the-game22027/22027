import { ContentSelector } from './content-selector';
import type { ContentSelectionCriteria, QuestionReadRepository } from './ports/question-read-repository';

describe('ContentSelector', () => {
  const pickRandomContentIds = jest.fn<Promise<string[]>, [ContentSelectionCriteria]>();
  const selector = new ContentSelector({ pickRandomContentIds } as unknown as QuestionReadRepository);
  const valid: ContentSelectionCriteria = { gameType: 'BUZZER', count: 5, locales: ['ar'], excludeContentIds: [] };

  beforeEach(() => {
    pickRandomContentIds.mockReset().mockResolvedValue(['a', 'b']);
  });

  it('passes valid criteria to the repository and returns what it found, even when short', async () => {
    await expect(selector.pickContentIds(valid)).resolves.toEqual(['a', 'b']);
    expect(pickRandomContentIds).toHaveBeenCalledWith(valid);
  });

  it.each([
    [{ count: 0 }, 'count'],
    [{ count: 1.5 }, 'count'],
    [{ locales: [] }, 'locale'],
    [{ locales: ['fr'] }, 'unsupported locale'],
    [{ difficulties: [] }, 'difficulties'],
    [{ minAnswersPerSlot: 0 }, 'minAnswersPerSlot'],
  ])('refuses %p', async (change, message) => {
    const criteria = { ...valid, ...change } as ContentSelectionCriteria;
    await expect(selector.pickContentIds(criteria)).rejects.toThrow(message);
    expect(pickRandomContentIds).not.toHaveBeenCalled();
  });
});
