import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import { PerUserRateLimitGuard, RateLimitPerUser } from '@shared/infrastructure/rate-limit/per-user-rate-limit.guard';
import { SocialPages } from '../application/social-pages';
import { UserProfileDto, UserSearchPageDto, UserSearchQueryDto } from './dto/social.dto';

/** Finding other players. In `social`, because every answer must hide blocks (03 §7.1). */
@ApiTags('social')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UserDirectoryController {
  constructor(private readonly pages: SocialPages) {}

  @Get()
  @UseGuards(PerUserRateLimitGuard)
  @RateLimitPerUser('userSearch')
  search(@CurrentUser() auth: AuthContext, @Query() query: UserSearchQueryDto): Promise<UserSearchPageDto> {
    return this.pages.searchUsers(auth.userId, query.query, {
      ...(query.limit ? { limit: query.limit } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
  }

  @Get(':userId')
  profile(@CurrentUser() auth: AuthContext, @Param('userId', ParseUUIDPipe) userId: string): Promise<UserProfileDto> {
    return this.pages.getUserProfile(auth.userId, userId);
  }
}
