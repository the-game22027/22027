import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PublicUserDto } from '@modules/users';
import { type Board, BOARDS } from '../../domain/boards';
import { PERIOD_KINDS, type PeriodKind } from '../../domain/period-calendar';

export class ListPeriodsQueryDto {
  @IsIn(PERIOD_KINDS)
  kind!: PeriodKind;
}

export class LeaderboardPathDto {
  @IsIn(PERIOD_KINDS)
  kind!: PeriodKind;

  /** `current`, or a key such as 2026-W46, 2026-11, 2026-27, all. */
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/)
  periodKey!: string;
}

export class LeaderboardCategoryQueryDto {
  @IsIn(BOARDS)
  category!: Board;
}

export class LeaderboardPageQueryDto extends LeaderboardCategoryQueryDto {
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

export class LeaderboardPeriodDto {
  kind!: PeriodKind;
  key!: string;
  startsAt!: string;
  endsAt!: string | null;
  status!: 'OPEN' | 'CLOSED';
}

export class LeaderboardPeriodListDto {
  items!: LeaderboardPeriodDto[];
}

export class LeaderboardRowDto {
  rank!: number;
  user!: PublicUserDto;
  points!: number;
  isMe!: boolean;
}

export class LeaderboardPageDto {
  period!: LeaderboardPeriodDto;
  category!: Board;
  items!: LeaderboardRowDto[];
  nextCursor!: string | null;
}

export class MyRankDto {
  /** null: no points in this period yet. */
  rank!: number | null;
  points!: number;
  around!: LeaderboardRowDto[];
}
