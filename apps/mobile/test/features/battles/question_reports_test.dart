import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/features/battles/data/question_reports_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

void main() {
  test('reporting posts the reason and completes on 204', () async {
    final adapter = FakeHttpAdapter((_) => ResponseBody.fromString('', 204));
    final container = await createSignedInTestContainer(adapter);

    await container
        .read(questionReportsRepositoryProvider)
        .reportQuestion(questionId: 'q-1', reason: 'Wrong year');

    final sent = adapter.sentRequests.single;
    expect(sent.method, 'POST');
    expect(sent.path, '/v1/questions/q-1/reports');
    expect(jsonDecode(sent.data as String), {'reason': 'Wrong year'});
  });

  for (final (status, code, reason) in [
    (404, 'QUESTION_NOT_FOUND', QuestionReportFailureReason.questionNotFound),
    (400, 'INVALID_REPORT_REASON', QuestionReportFailureReason.invalidReason),
  ]) {
    test('$code is a typed failure', () async {
      final adapter = FakeHttpAdapter((_) => problemResponse(status, code));
      final container = await createSignedInTestContainer(adapter);

      await expectLater(
        container
            .read(questionReportsRepositoryProvider)
            .reportQuestion(questionId: 'q-1', reason: ' '),
        throwsA(
          isA<KnownProblemError<QuestionReportFailureReason>>().having(
            (error) => error.reason,
            'reason',
            reason,
          ),
        ),
      );
    });
  }
}
