import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@shared/infrastructure/http/public.decorator';
import { AuthRateLimitGuard } from '@shared/infrastructure/rate-limit/auth-rate-limit.guard';
import { MeQuery } from '../application/me.query';
import { GOOGLE_TOKEN_VERIFIER, type GoogleTokenVerifier } from '../application/ports/google-token-verifier';
import { RefreshSessionService } from '../application/refresh-session.service';
import { SignInService } from '../application/sign-in.service';
import { authTokens, deviceFrom } from './auth-response';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { GoogleSignInDto, RefreshDto } from './dto/sign-in.dto';

@ApiTags('auth')
@UseGuards(AuthRateLimitGuard)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    @Inject(GOOGLE_TOKEN_VERIFIER) private readonly google: GoogleTokenVerifier,
    private readonly signIn: SignInService,
    private readonly refreshSessions: RefreshSessionService,
    private readonly me: MeQuery,
  ) {}

  /** 201 for a new account, 200 for an existing one. */
  @Public()
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

  /** Rotates the refresh token: the old one stops working, and presenting it again revokes the whole sign-in. */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RefreshDto, @Req() req: Request): Promise<AuthTokensDto> {
    const { userAgent, ip } = deviceFrom(undefined, req);
    const result = await this.refreshSessions.refresh(body.refreshToken, {
      ...(userAgent ? { userAgent } : {}),
      ...(ip ? { ip } : {}),
    });
    return authTokens(result.session, await this.me.forUser(result.userId), false);
  }
}
