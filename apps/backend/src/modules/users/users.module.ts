import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from './application/ports/user-repository';
import { UsersFacade } from './application/users.facade';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';

@Module({
  providers: [UsersFacade, { provide: USER_REPOSITORY, useClass: PrismaUserRepository }],
  exports: [UsersFacade],
})
export class UsersModule {}
