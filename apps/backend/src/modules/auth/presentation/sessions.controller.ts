import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../application/ports/access-tokens';
import { SessionsService } from '../application/sessions.service';
import { CurrentUser } from './current-user.decorator';
import { SessionInfoDto } from './dto/session-info.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() auth: AuthContext): Promise<void> {
    return this.sessions.logout(auth);
  }

  @Get('sessions')
  async list(@CurrentUser() auth: AuthContext): Promise<SessionInfoDto[]> {
    const sessions = await this.sessions.list(auth);
    return sessions.map((session) => ({
      id: session.id,
      ...(session.platform ? { platform: session.platform } : {}),
      ...(session.deviceName ? { deviceName: session.deviceName } : {}),
      createdAt: session.signedInAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      current: session.current,
    }));
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  revoke(@CurrentUser() auth: AuthContext, @Param('sessionId', ParseUUIDPipe) sessionId: string): Promise<void> {
    return this.sessions.revoke(auth, sessionId);
  }
}
