import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';

enum QuestionReportFailureReason { questionNotFound, invalidReason }

const questionReportFailureReasonsByCode = {
  'QUESTION_NOT_FOUND': QuestionReportFailureReason.questionNotFound,
  'INVALID_REPORT_REASON': QuestionReportFailureReason.invalidReason,
};

/// Reporting a wrong question (API §6.6).
class QuestionReportsRepository {
  QuestionReportsRepository(this._questionsApi);

  final QuestionsApi _questionsApi;

  /// `POST /v1/questions/{questionId}/reports`. Only a question the player was served in a
  /// battle can be reported (`404 QUESTION_NOT_FOUND` otherwise); reporting twice is a no-op.
  /// [reason] is 1 to 500 characters; the server checks it (`INVALID_REPORT_REASON`).
  Future<void> reportQuestion({
    required String questionId,
    required String reason,
  }) => convertKnownProblems(
    () => sendRequestWithoutData(
      () => _questionsApi.questionReportsControllerReportV1(
        questionId: questionId,
        reportQuestionDto: ReportQuestionDto(reason: reason),
      ),
    ),
    (problem) => findReasonByCode(problem, questionReportFailureReasonsByCode),
  );
}

final questionReportsRepositoryProvider = Provider<QuestionReportsRepository>(
  (ref) =>
      QuestionReportsRepository(ref.watch(apiClientProvider).getQuestionsApi()),
);
