import { IsIn, IsOptional, IsString, IsUrl, Length, MaxLength, ValidateIf } from 'class-validator';
import type { Locale } from '@modules/users';

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
  @IsIn(['ar', 'en'])
  locale?: Locale;
}
