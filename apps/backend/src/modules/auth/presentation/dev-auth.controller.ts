import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MeQuery } from '../application/me.query';
import { SignInService } from '../application/sign-in.service';
import { authTokens, deviceFrom } from './auth-response';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { DevSignInDto } from './dto/sign-in.dto';

/** Signs in as any made-up Google account. Registered only outside production. */
@ApiTags('dev')
@Controller({ path: '_dev/auth', version: '1' })
export class DevAuthController {
  constructor(
    private readonly signIn: SignInService,
    private readonly me: MeQuery,
  ) {}

  @Post('sign-in')
  async devSignIn(
    @Body() body: DevSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const result = await this.signIn.signIn(
      {
        provider: 'GOOGLE',
        subject: `dev:${body.subject}`,
        email: null,
        emailVerified: false,
        ...(body.displayName ? { displayName: body.displayName } : {}),
      },
      deviceFrom(body.device, req),
    );
    res.status(result.isNewUser ? 201 : 200);
    return authTokens(result.session, await this.me.forUser(result.userId), result.isNewUser);
  }
}
