import { Module } from '@nestjs/common';
import { ACCESS_TOKENS } from './application/ports/access-tokens';
import { JoseAccessTokens } from './infrastructure/jose-access-tokens';

@Module({
  providers: [{ provide: ACCESS_TOKENS, useClass: JoseAccessTokens }],
})
export class AuthModule {}
