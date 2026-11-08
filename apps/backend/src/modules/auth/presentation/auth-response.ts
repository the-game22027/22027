import type { Request } from 'express';
import type { MeView } from '../application/me.query';
import type { DeviceInfo } from '../application/ports/session-repository';
import type { IssuedSession } from '../application/session-issuer';
import type { AuthTokensDto } from './dto/auth-tokens.dto';
import type { DeviceDto } from './dto/sign-in.dto';

export function deviceFrom(device: DeviceDto | undefined, req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent']?.slice(0, 512);
  return {
    ...(device?.platform ? { platform: device.platform } : {}),
    ...(device?.name ? { deviceName: device.name } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(req.ip ? { ip: req.ip } : {}),
  };
}

export function authTokens(session: IssuedSession, me: MeView, isNewUser: boolean): AuthTokensDto {
  return {
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
    refreshToken: session.refreshToken,
    user: { ...me, identities: [...me.identities] },
    isNewUser,
  };
}
