import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { PublicUserDto } from '@modules/users';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

export class SendFriendRequestDto {
  @IsUUID()
  userId!: string;
}

export class ListFriendRequestsQueryDto extends PageQueryDto {
  @IsIn(['incoming', 'outgoing'])
  direction!: 'incoming' | 'outgoing';
}

export class UserSearchQueryDto extends PageQueryDto {
  /** 2 to 50 characters after trimming. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  query!: string;
}

export class FriendRequestDto {
  id!: string;
  from!: PublicUserDto;
  to!: PublicUserDto;
  status!: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt!: string;
}

export class FriendRequestPageDto {
  items!: FriendRequestDto[];
  nextCursor!: string | null;
}

/** A friend, or a player you blocked, with when it started. */
export class ConnectedUserDto {
  user!: PublicUserDto;
  since!: string;
}

export class ConnectedUserPageDto {
  items!: ConnectedUserDto[];
  nextCursor!: string | null;
}

export class UserSearchPageDto {
  items!: PublicUserDto[];
  nextCursor!: string | null;
}

export class UserProfileDto extends PublicUserDto {
  relationship!: 'SELF' | 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';
  /** Set for REQUEST_SENT and REQUEST_RECEIVED, so the app can cancel or accept. */
  requestId!: string | null;
}
