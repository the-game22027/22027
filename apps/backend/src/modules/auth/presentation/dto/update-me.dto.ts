import { IsIn, IsOptional, IsString, IsUrl, IsUUID, Length, MaxLength, ValidateIf } from 'class-validator';
import { type Locale, LOCALES } from '@shared/kernel';

const providedOrNull = (_: object, value: unknown): boolean => value !== undefined;

export class UpdateMeDto {
  @ValidateIf(providedOrNull)
  @IsString()
  @Length(1, 200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ValidateIf(providedOrNull)
  @IsIn(LOCALES)
  locale?: Locale;

  @IsOptional()
  @IsUUID()
  favouriteTeamId?: string | null;
}
