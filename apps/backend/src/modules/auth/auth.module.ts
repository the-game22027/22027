import { type DynamicModule, Module } from '@nestjs/common';
import { UsersModule } from '@modules/users';
import type { AppConfig } from '@shared/infrastructure/config';
import { MeQuery } from './application/me.query';
import { ACCESS_TOKENS } from './application/ports/access-tokens';
import { GOOGLE_TOKEN_VERIFIER } from './application/ports/google-token-verifier';
import { IDENTITY_REPOSITORY } from './application/ports/identity-repository';
import { SESSION_REPOSITORY } from './application/ports/session-repository';
import { SessionIssuer } from './application/session-issuer';
import { SignInService } from './application/sign-in.service';
import { JoseAccessTokens } from './infrastructure/jose-access-tokens';
import { JoseGoogleTokenVerifier } from './infrastructure/jose-google-token-verifier';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { AuthController } from './presentation/auth.controller';
import { DevAuthController } from './presentation/dev-auth.controller';

@Module({})
export class AuthModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: [UsersModule],
      controllers: [AuthController, ...(config.devToolsEnabled ? [DevAuthController] : [])],
      providers: [
        SignInService,
        SessionIssuer,
        MeQuery,
        { provide: ACCESS_TOKENS, useClass: JoseAccessTokens },
        { provide: GOOGLE_TOKEN_VERIFIER, useClass: JoseGoogleTokenVerifier },
        { provide: IDENTITY_REPOSITORY, useClass: PrismaIdentityRepository },
        { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
      ],
    };
  }
}
