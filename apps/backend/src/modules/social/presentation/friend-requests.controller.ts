import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { type AuthContext, CurrentUser } from '@modules/auth';
import { PerUserRateLimitGuard, RateLimitPerUser } from '@shared/infrastructure/rate-limit/per-user-rate-limit.guard';
import { SocialFacade } from '../application/social.facade';
import { SocialPages } from '../application/social-pages';
import {
  FriendRequestDto,
  FriendRequestPageDto,
  ListFriendRequestsQueryDto,
  SendFriendRequestDto,
} from './dto/social.dto';
import { toFriendRequestDto } from './social-responses';

@ApiTags('social')
@ApiBearerAuth()
@Controller({ path: 'friend-requests', version: '1' })
export class FriendRequestsController {
  constructor(
    private readonly social: SocialFacade,
    private readonly pages: SocialPages,
  ) {}

  /** 201 for a new request; 200 with the same request when it was already pending (03 §7.1). */
  @Post()
  @UseGuards(PerUserRateLimitGuard)
  @RateLimitPerUser('friendRequests')
  async send(
    @CurrentUser() auth: AuthContext,
    @Body() body: SendFriendRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FriendRequestDto> {
    const { request, created } = await this.social.sendFriendRequest(auth.userId, body.userId);
    response.status(created ? 201 : 200);
    return toFriendRequestDto(await this.pages.viewFriendRequest(request));
  }

  @Get()
  async list(
    @CurrentUser() auth: AuthContext,
    @Query() query: ListFriendRequestsQueryDto,
  ): Promise<FriendRequestPageDto> {
    const page = await this.pages.listPendingRequests(auth.userId, query.direction, {
      ...(query.limit ? { limit: query.limit } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    return { items: page.items.map(toFriendRequestDto), nextCursor: page.nextCursor };
  }

  @Post(':requestId/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() auth: AuthContext,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<FriendRequestDto> {
    return toFriendRequestDto(
      await this.pages.viewFriendRequest(await this.social.acceptFriendRequest(requestId, auth.userId)),
    );
  }

  @Post(':requestId/decline')
  @HttpCode(200)
  async decline(
    @CurrentUser() auth: AuthContext,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<FriendRequestDto> {
    return toFriendRequestDto(
      await this.pages.viewFriendRequest(await this.social.declineFriendRequest(requestId, auth.userId)),
    );
  }

  @Delete(':requestId')
  @HttpCode(204)
  async cancel(@CurrentUser() auth: AuthContext, @Param('requestId', ParseUUIDPipe) requestId: string): Promise<void> {
    await this.social.cancelFriendRequest(requestId, auth.userId);
  }
}
