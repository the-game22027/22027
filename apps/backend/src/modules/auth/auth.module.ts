import { Module } from '@nestjs/common';
import { ACCESS_TOKENS } from './application/ports/access-tokens';
import { JoseAccessTokens } from './infrastructure/jose-access-tokens';

/** Sign-in, sessions and tokens (docs/architecture/01-modules.md §2.1, 04-auth.md). */
@Module({
  providers: [{ provide: ACCESS_TOKENS, useClass: JoseAccessTokens }],
})
export class AuthModule {}
