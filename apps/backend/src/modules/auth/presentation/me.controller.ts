import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersFacade } from '@modules/users';
import { MeQuery } from '../application/me.query';
import type { AuthContext } from '../application/ports/access-tokens';
import { CurrentUser } from './current-user.decorator';
import { MeDto } from './dto/auth-tokens.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly me: MeQuery,
    private readonly users: UsersFacade,
  ) {}

  @Get()
  getMe(@CurrentUser() auth: AuthContext): Promise<MeDto> {
    return this.view(auth.userId);
  }

  @Patch()
  async updateMe(@CurrentUser() auth: AuthContext, @Body() body: UpdateMeDto): Promise<MeDto> {
    await this.users.updateProfile(auth.userId, body);
    return this.view(auth.userId);
  }

  private async view(userId: string): Promise<MeDto> {
    const me = await this.me.forUser(userId);
    return { ...me, identities: [...me.identities] };
  }
}
