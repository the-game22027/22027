import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/api_problem.dart';

void main() {
  group('ApiProblem.fromResponseBody', () {
    test('reads every field of a problem+json body', () {
      final problem = ApiProblem.fromResponseBody(
        status: 400,
        body: {
          'type': '/errors/VALIDATION_FAILED',
          'title': 'Validation failed',
          'status': 400,
          'code': 'VALIDATION_FAILED',
          'detail': 'subject must be shorter',
          'traceId': 'abc',
          'errors': [
            {'field': 'subject', 'code': 'maxLength', 'message': 'too long'},
          ],
        },
      );

      expect(problem.status, 400);
      expect(problem.code, 'VALIDATION_FAILED');
      expect(problem.detail, 'subject must be shorter');
      expect(problem.traceId, 'abc');
      expect(problem.errors.single.field, 'subject');
      expect(problem.errors.single.code, 'maxLength');
    });

    test('accepts a body without errors', () {
      final problem = ApiProblem.fromResponseBody(
        status: 404,
        body: {'status': 404, 'code': 'NOT_FOUND'},
      );

      expect(problem.code, 'NOT_FOUND');
      expect(problem.errors, isEmpty);
    });

    test('keeps a code it does not know, and ignores unknown fields', () {
      final problem = ApiProblem.fromResponseBody(
        status: 409,
        body: {
          'status': 409,
          'code': 'SOMETHING_NEW_IN_V2',
          'activity': {'type': 'QUEUE', 'id': 'x'},
        },
      );

      expect(problem.code, 'SOMETHING_NEW_IN_V2');
      expect(problem.status, 409);
    });

    test('decodes a body that arrives as a JSON string', () {
      final problem = ApiProblem.fromResponseBody(
        status: 429,
        body: '{"status":429,"code":"RATE_LIMITED"}',
      );

      expect(problem.code, 'RATE_LIMITED');
    });

    test('keeps only the status when the body is not JSON', () {
      final problem = ApiProblem.fromResponseBody(
        status: 502,
        body: '<html>Bad gateway</html>',
      );

      expect(problem.status, 502);
      expect(problem.code, isNull);
      expect(problem.errors, isEmpty);
    });

    test('ignores fields with the wrong type', () {
      final problem = ApiProblem.fromResponseBody(
        status: 400,
        body: {
          'status': '400',
          'code': 42,
          'errors': [
            'not an object',
            {'field': 7},
          ],
        },
      );

      expect(problem.status, 400);
      expect(problem.code, isNull);
      expect(problem.errors, isEmpty);
    });
  });
}
