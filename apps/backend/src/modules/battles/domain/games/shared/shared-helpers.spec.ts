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
import { findNextHintAt } from './hint-schedule';
import { findLockedUntil, lockOutAfterWrongTry, noLockouts } from './lockout-ladder';

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

  it('LockoutLadder locks a player longer after each wrong try, the last step repeating', () => {
    const at = (ms: number) => new Date(Date.UTC(2026, 10, 20) + ms);
    let lockouts = noLockouts(['a', 'b']);
    expect(findLockedUntil(lockouts, 'a', at(0))).toBeNull();
    const steps = [3000, 6000];
    lockouts = lockOutAfterWrongTry(lockouts, 'a', at(0), steps);
    expect(findLockedUntil(lockouts, 'a', at(1000))).toEqual(at(3000));
    expect(findLockedUntil(lockouts, 'a', at(3000))).toBeNull();
    expect(findLockedUntil(lockouts, 'b', at(1000))).toBeNull();
    lockouts = lockOutAfterWrongTry(lockouts, 'a', at(3000), steps);
    expect(findLockedUntil(lockouts, 'a', at(3000))).toEqual(at(9000));
    lockouts = lockOutAfterWrongTry(lockouts, 'a', at(9000), steps);
    expect(lockouts.a).toEqual({ wrongTries: 3, lockedUntil: at(15000) });
  });

  it('HintSchedule gives the first hint late, then one every interval, up to the max', () => {
    const start = new Date(Date.UTC(2026, 10, 20));
    const schedule = { firstAtMs: 45000, everyMs: 15000, max: 2 };
    expect(findNextHintAt(start, schedule, 0)).toEqual(new Date(start.getTime() + 45000));
    expect(findNextHintAt(start, schedule, 1)).toEqual(new Date(start.getTime() + 60000));
    expect(findNextHintAt(start, schedule, 2)).toBeNull();
  });
});
