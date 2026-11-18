import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PublicUserDto } from '@modules/users';

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

export class PredictionPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

// A named class, not an inline `{ points }` type: only then does the Swagger plugin mark `score` nullable.
export class PredictionScoreDto {
  points!: number;
}

/** Another player's prediction, shown only when the visibility policy allows it (DEC-21). */
export class VisiblePredictionDto {
  matchId!: string;
  picks!: PredictionPickDto[];
  status!: 'ACTIVE' | 'VOID';
  updatedAt!: string;
  /** null until prediction scoring exists (P3.2). */
  score!: PredictionScoreDto | null;
}

export class VisiblePredictionPageDto {
  items!: VisiblePredictionDto[];
  nextCursor!: string | null;
}

export class FriendPredictionDto {
  user!: PublicUserDto;
  picks!: PredictionPickDto[];
  status!: 'ACTIVE' | 'VOID';
  /** null until prediction scoring exists (P3.2). */
  score!: PredictionScoreDto | null;
}

export class FriendPredictionPageDto {
  items!: FriendPredictionDto[];
  nextCursor!: string | null;
}
