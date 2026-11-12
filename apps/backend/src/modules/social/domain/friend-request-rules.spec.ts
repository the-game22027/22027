import { decideFriendRequest, describeRelationship, type FriendRequestFacts } from './friend-request-rules';
import { orderFriendPair } from './friend-pair';
import {
  AlreadyFriendsError,
  CannotTargetYourselfError,
  FriendRequestExistsError,
  UserNotFoundError,
} from './social-errors';

const facts = (overrides: Partial<FriendRequestFacts> = {}): FriendRequestFacts => ({
  requesterId: 'me',
  addresseeId: 'them',
  addresseeIsActive: true,
  blockedEitherWay: false,
  alreadyFriends: false,
  pending: null,
  ...overrides,
});

describe('decideFriendRequest', () => {
  it('creates a request between two strangers', () => {
    expect(decideFriendRequest(facts())).toEqual({ kind: 'CREATE' });
  });

  it('returns my own pending request again instead of a second one', () => {
    expect(decideFriendRequest(facts({ pending: { id: 'r1', requesterId: 'me' } }))).toEqual({
      kind: 'RETURN_EXISTING',
      requestId: 'r1',
    });
  });

  it('points to their request when they already asked me', () => {
    const decide = () => decideFriendRequest(facts({ pending: { id: 'r2', requesterId: 'them' } }));
    expect(decide).toThrow(FriendRequestExistsError);
    try {
      decide();
    } catch (error) {
      expect((error as FriendRequestExistsError).details).toEqual({ requestId: 'r2' });
    }
  });

  it('answers a block exactly like an unknown player', () => {
    expect(() => decideFriendRequest(facts({ blockedEitherWay: true }))).toThrow(UserNotFoundError);
    expect(() => decideFriendRequest(facts({ addresseeIsActive: false }))).toThrow(UserNotFoundError);
  });

  it('refuses yourself and existing friends', () => {
    expect(() => decideFriendRequest(facts({ addresseeId: 'me' }))).toThrow(CannotTargetYourselfError);
    expect(() => decideFriendRequest(facts({ alreadyFriends: true }))).toThrow(AlreadyFriendsError);
  });
});

describe('describeRelationship', () => {
  it('tells each side of a pending request apart', () => {
    const pending = { id: 'r1', requesterId: 'me' };
    expect(describeRelationship('me', 'them', { friends: false, pending })).toEqual({
      relationship: 'REQUEST_SENT',
      requestId: 'r1',
    });
    expect(describeRelationship('them', 'me', { friends: false, pending })).toEqual({
      relationship: 'REQUEST_RECEIVED',
      requestId: 'r1',
    });
  });

  it('knows yourself, friends and strangers', () => {
    expect(describeRelationship('me', 'me', { friends: false, pending: null }).relationship).toBe('SELF');
    expect(describeRelationship('me', 'them', { friends: true, pending: null }).relationship).toBe('FRIENDS');
    expect(describeRelationship('me', 'them', { friends: false, pending: null }).relationship).toBe('NONE');
  });
});

describe('orderFriendPair', () => {
  it('stores a pair the same way whoever comes first', () => {
    const a = '0190a000-0000-7000-8000-000000000001';
    const b = '0190a000-0000-7000-8000-000000000002';
    expect(orderFriendPair(b, a)).toEqual(orderFriendPair(a, b));
    expect(orderFriendPair(b, a)).toEqual({ userLowId: a, userHighId: b });
  });
});
