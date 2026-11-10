import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/api_problem.dart';
import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/retry_policy.dart';

void main() {
  group('chooseRetryDelayForFailedProvider', () {
    test('never retries a client error', () {
      for (final status in [400, 401, 403, 404, 409, 429]) {
        expect(
          chooseRetryDelayForFailedProvider(
            0,
            ApiProblemError(ApiProblem(status: status)),
          ),
          isNull,
          reason: 'status $status',
        );
      }
    });

    test('never retries a response that broke the contract or a bug', () {
      expect(
        chooseRetryDelayForFailedProvider(
          0,
          const UnexpectedResponseError('x'),
        ),
        isNull,
      );
      expect(chooseRetryDelayForFailedProvider(0, StateError('bug')), isNull);
    });

    test('retries transient failures a few times, then stops', () {
      for (final error in [
        const ServerUnreachableError(),
        const RequestTimedOutError(),
        const ApiProblemError(ApiProblem(status: 503)),
      ]) {
        expect(chooseRetryDelayForFailedProvider(0, error), isNotNull);
        expect(chooseRetryDelayForFailedProvider(3, error), isNull);
      }
    });
  });
}
