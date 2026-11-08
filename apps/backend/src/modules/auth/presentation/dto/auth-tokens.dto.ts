import type { AuthProvider } from '../../domain/auth-provider';

export class IdentityDto {
  id!: string;
  provider!: AuthProvider;
  label!: string;
}

export class PrivacyDto {
  predictionVisibility!: string | null;
}

export class MeDto {
  id!: string;
  displayName!: string;
  username!: string | null;
  avatarUrl!: string | null;
  locale!: string;
  identities!: IdentityDto[];
  privacy!: PrivacyDto;
}

export class AuthTokensDto {
  accessToken!: string;
  accessTokenExpiresAt!: string;
  refreshToken!: string;
  user!: MeDto;
  isNewUser!: boolean;
}
