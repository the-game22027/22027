import type { ConnectedUserView, FriendRequestView } from '../application/social-pages';
import type { ConnectedUserDto, FriendRequestDto } from './dto/social.dto';

export const toFriendRequestDto = (request: FriendRequestView): FriendRequestDto => ({
  ...request,
  createdAt: request.createdAt.toISOString(),
});

export const toConnectedUserDto = ({ user, since }: ConnectedUserView): ConnectedUserDto => ({
  user,
  since: since.toISOString(),
});
