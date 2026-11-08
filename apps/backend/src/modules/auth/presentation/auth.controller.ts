import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MeQuery } from '../application/me.query';
import { GOOGLE_TOKEN_VERIFIER, type GoogleTokenVerifier } from '../application/ports/google-token-verifier';
import { SignInService } from '../application/sign-in.service';
import { authTokens, deviceFrom } from './auth-response';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { GoogleSignInDto } from './dto/sign-in.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    @Inject(GOOGLE_TOKEN_VERIFIER) private readonly google: GoogleTokenVerifier,
    private readonly signIn: SignInService,
    private readonly me: MeQuery,
  ) {}

  /** 201 for a new account, 200 for an existing one. */
  @Post('google')
  async signInWithGoogle(
    @Body() body: GoogleSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const identity = await this.google.verify(body.idToken);
    const result = await this.signIn.signIn(identity, deviceFrom(body.device, req));
    res.status(result.isNewUser ? 201 : 200);
    return authTokens(result.session, await this.me.forUser(result.userId), result.isNewUser);
  }
}
