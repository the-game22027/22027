import { canViewPrediction, type PredictionVisibilityFacts } from './prediction-visibility';

const facts = (overrides: Partial<PredictionVisibilityFacts>): PredictionVisibilityFacts => ({
  viewerId: 'viewer',
  ownerId: 'owner',
  areFriends: true,
  blockedEitherWay: false,
  kickoffPassed: true,
  ...overrides,
});

describe('canViewPrediction (DEC-21)', () => {
  it.each([
    ['the owner, before kickoff', { viewerId: 'owner', areFriends: false, kickoffPassed: false }, true],
    ['a friend, after kickoff', {}, true],
    ['a friend, before kickoff', { kickoffPassed: false }, false],
    ['a stranger, after kickoff', { areFriends: false }, false],
    ['a blocked player, after kickoff', { areFriends: false, blockedEitherWay: true }, false],
  ] as const)('%s → %s', (_who, overrides, visible) => {
    expect(canViewPrediction(facts(overrides))).toBe(visible);
  });
});
