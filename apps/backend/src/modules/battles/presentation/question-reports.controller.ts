import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthContext, CurrentUser } from '@modules/auth';
import { ReportServedQuestion } from '../application/report-served-question';
import { ReportQuestionDto } from './dto/question-report.dto';

@ApiTags('questions')
@ApiBearerAuth()
@Controller({ path: 'questions/:questionId/reports', version: '1' })
export class QuestionReportsController {
  constructor(private readonly reportServedQuestion: ReportServedQuestion) {}

  /** 204 also for a repeat: the player's first report stays (08 §5.7). */
  @Post()
  @HttpCode(204)
  async report(
    @CurrentUser() auth: AuthContext,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: ReportQuestionDto,
  ): Promise<void> {
    await this.reportServedQuestion.reportServedQuestion(questionId, auth.userId, body.reason);
  }
}
