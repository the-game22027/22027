import { SeededRandom } from '../../random-source';
import { giveEveryoneHearts, hasHeartsLeft, loseHeart } from './hearts';
import {
  addSecretChoice,
  choicesOf,
  fillMissingSecretChoices,
  findSecretChoiceRejection,
  hasEveryoneChosen,
  startSecretChoices,
} from './secret-choices';
import { addUsedAnswer, hasAnswerBeenUsed } from './used-answers';

describe('shared rule helpers', () => {
  it('UsedAnswers keeps each name once, in the order said', () => {
    const used = addUsedAnswer(addUsedAnswer(addUsedAnswer([], 'a'), 'b'), 'a');
    expect(used).toEqual(['a', 'b']);
    expect(hasAnswerBeenUsed(used, 'b')).toBe(true);
    expect(hasAnswerBeenUsed(used, 'c')).toBe(false);
  });

  it('Hearts never go below zero', () => {
    let hearts = giveEveryoneHearts(['p', 'q'], 1);
    hearts = loseHeart(loseHeart(hearts, 'p'), 'p');
    expect(hearts).toEqual({ p: 0, q: 1 });
    expect(hasHeartsLeft(hearts, 'p')).toBe(false);
    expect(hasHeartsLeft(hearts, 'q')).toBe(true);
  });

  it('SecretChoices takes up to count distinct picks per player', () => {
    let choices = startSecretChoices(['p', 'q'], 2);
    choices = addSecretChoice(choices, 'p', 'x');
    expect(findSecretChoiceRejection(choices, 'p', 'x')).toBe('ALREADY_CHOSEN');
    choices = addSecretChoice(choices, 'p', 'y');
    expect(findSecretChoiceRejection(choices, 'p', 'z')).toBe('ALL_CHOSEN');
    expect(findSecretChoiceRejection(choices, 'q', 'x')).toBeNull();
    expect(hasEveryoneChosen(choices)).toBe(false);
  });

  it('fills missing picks without repeating a player own picks, the same way for the same seed', () => {
    const choices = addSecretChoice(startSecretChoices(['p', 'q'], 2), 'p', 'x');
    const fill = () => fillMissingSecretChoices(choices, ['x', 'y', 'z'], new SeededRandom(3));
    const filled = fill();
    expect(hasEveryoneChosen(filled)).toBe(true);
    expect(choicesOf(filled, 'p')[0]).toEqual({ entityId: 'x', auto: false });
    expect(choicesOf(filled, 'p')[1]).toMatchObject({ auto: true });
    expect(choicesOf(filled, 'p')[1].entityId).not.toBe('x');
    expect(new Set(choicesOf(filled, 'q').map((choice) => choice.entityId)).size).toBe(2);
    expect(fill()).toEqual(filled);
  });
});
