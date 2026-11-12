import { Module } from '@nestjs/common';
import { UsersModule } from '@modules/users';
import { RateLimitModule } from '@shared/infrastructure/rate-limit/rate-limit.module';
import { SOCIAL_REPOSITORY } from './application/ports/social-repository';
import { SocialFacade } from './application/social.facade';
import { SocialPages } from './application/social-pages';
import { SocialQuery } from './application/social.query';
import { PrismaSocialRepository } from './infrastructure/prisma-social.repository';
import { FriendRequestsController } from './presentation/friend-requests.controller';
import { MyConnectionsController } from './presentation/my-connections.controller';
import { UserDirectoryController } from './presentation/user-directory.controller';

/** Friends, blocks and finding players (01 §2.12). */
@Module({
  imports: [UsersModule, RateLimitModule],
  controllers: [FriendRequestsController, MyConnectionsController, UserDirectoryController],
  providers: [SocialFacade, SocialPages, SocialQuery, { provide: SOCIAL_REPOSITORY, useClass: PrismaSocialRepository }],
  exports: [SocialQuery],
})
export class SocialModule {}
