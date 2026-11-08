import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

export class DeviceDto {
  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
}

export class GoogleSignInDto {
  @IsString()
  @Length(1, 4096)
  idToken!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: DeviceDto;
}

export class DevSignInDto {
  @IsString()
  @Length(1, 64)
  subject!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  displayName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: DeviceDto;
}

export class RefreshDto {
  @IsString()
  @Length(1, 200)
  refreshToken!: string;
}
