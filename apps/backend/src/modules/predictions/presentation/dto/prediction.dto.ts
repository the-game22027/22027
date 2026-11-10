import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SubmittedPickDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsInt()
  home?: number;

  @IsOptional()
  @IsInt()
  away?: number;
}

export class SubmitPredictionDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SubmittedPickDto)
  picks!: SubmittedPickDto[];
}

export class PredictionPickDto {
  type!: 'EXACT_SCORE' | 'RESULT';
  home?: number;
  away?: number;
  outcome?: 'HOME' | 'DRAW' | 'AWAY';
}

export class PredictionDto {
  id!: string;
  matchId!: string;
  picks!: PredictionPickDto[];
  revision!: number;
  status!: 'ACTIVE' | 'VOID';
  updatedAt!: string;
  locked!: boolean;
}
