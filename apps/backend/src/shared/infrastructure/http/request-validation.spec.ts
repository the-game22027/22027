import { Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { flattenValidationErrors } from './request-validation';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

class PickDto {
  @IsInt()
  @Min(0)
  homeScore!: number;
}

class SubmitDto {
  @IsString()
  matchId!: string;

  @ValidateNested({ each: true })
  @Type(() => PickDto)
  picks!: PickDto[];
}

describe('flattenValidationErrors', () => {
  it('builds dotted field paths with array indexes', () => {
    const dto = plainToInstance(SubmitDto, { matchId: 7, picks: [{ homeScore: 1 }, { homeScore: -1 }] });
    const errors = flattenValidationErrors(validateSync(dto));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'matchId', code: 'isString' }),
        expect.objectContaining({ field: 'picks[1].homeScore', code: 'min' }),
      ]),
    );
    expect(errors).toHaveLength(2);
  });
});
