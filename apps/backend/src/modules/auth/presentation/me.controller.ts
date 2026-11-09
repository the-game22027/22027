import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeQuery } from '../application/me.query';
import type { AuthContext } from '../application/ports/access-tokens';
import { CurrentUser } from './current-user.decorator';
import { MeDto } from './dto/auth-tokens.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(private readonly me: MeQuery) {}

  @Get()
  async getMe(@CurrentUser() auth: AuthContext): Promise<MeDto> {
    const me = await this.me.forUser(auth.userId);
    return { ...me, identities: [...me.identities] };
  }
}
