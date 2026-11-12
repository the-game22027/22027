import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import { SocialFacade } from '../application/social.facade';
import { SocialPages } from '../application/social-pages';
import { ConnectedUserPageDto, PageQueryDto } from './dto/social.dto';
import { toConnectedUserDto } from './social-responses';

const pageOf = (query: PageQueryDto) => ({
  ...(query.limit ? { limit: query.limit } : {}),
  ...(query.cursor ? { cursor: query.cursor } : {}),
});

/** The caller's friends and blocks (API.md §6.10). Every change is idempotent: repeating it answers 204 again. */
@ApiTags('social')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MyConnectionsController {
  constructor(
    private readonly social: SocialFacade,
    private readonly pages: SocialPages,
  ) {}

  @Get('friends')
  async friends(@CurrentUser() auth: AuthContext, @Query() query: PageQueryDto): Promise<ConnectedUserPageDto> {
    const page = await this.pages.listFriends(auth.userId, pageOf(query));
    return { items: page.items.map(toConnectedUserDto), nextCursor: page.nextCursor };
  }

  @Delete('friends/:userId')
  @HttpCode(204)
  async unfriend(@CurrentUser() auth: AuthContext, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.social.unfriend(auth.userId, userId);
  }

  @Get('blocks')
  async blocks(@CurrentUser() auth: AuthContext, @Query() query: PageQueryDto): Promise<ConnectedUserPageDto> {
    const page = await this.pages.listBlockedUsers(auth.userId, pageOf(query));
    return { items: page.items.map(toConnectedUserDto), nextCursor: page.nextCursor };
  }

  @Put('blocks/:userId')
  @HttpCode(204)
  async block(@CurrentUser() auth: AuthContext, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.social.blockUser(auth.userId, userId);
  }

  @Delete('blocks/:userId')
  @HttpCode(204)
  async unblock(@CurrentUser() auth: AuthContext, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.social.unblockUser(auth.userId, userId);
  }
}
