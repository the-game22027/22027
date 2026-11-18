import { IsString, Matches, MaxLength } from 'class-validator';

export class ReportQuestionDto {
  /** What is wrong with the question, in the player's words. */
  @IsString()
  @Matches(/\S/, { message: 'reason must not be blank' })
  @MaxLength(500)
  reason!: string;
}
