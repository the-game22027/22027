import { DomainError } from '@shared/kernel';

/** Unknown, deleted, or a block in either direction: the same answer for all, so blocks stay invisible. */
export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor() {
    super('There is no such player.');
  }
}

export class CannotTargetYourselfError extends DomainError {
  readonly code = 'CANNOT_TARGET_YOURSELF';
  readonly kind = 'UNPROCESSABLE';

  constructor() {
    super('You cannot do this to yourself.');
  }
}

/** The other player already asked you; `requestId` lets the app offer to accept it. */
export class FriendRequestExistsError extends DomainError {
  readonly code = 'FRIEND_REQUEST_EXISTS';
  readonly kind = 'CONFLICT';

  constructor(requestId: string) {
    super('This player already sent you a friend request.', { requestId });
  }
}

export class AlreadyFriendsError extends DomainError {
  readonly code = 'ALREADY_FRIENDS';
  readonly kind = 'CONFLICT';

  constructor() {
    super('You are already friends.');
  }
}

/** Unknown, or not yours to answer or cancel. */
export class FriendRequestNotFoundError extends DomainError {
  readonly code = 'FRIEND_REQUEST_NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor() {
    super('There is no such friend request.');
  }
}

export class FriendRequestNotPendingError extends DomainError {
  readonly code = 'FRIEND_REQUEST_NOT_PENDING';
  readonly kind = 'CONFLICT';

  constructor() {
    super('This friend request was already answered or cancelled.');
  }
}
