import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/api_problem.dart';
import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

void main() {
  final english = lookupAppLocalizations(const Locale('en'));
  final arabic = lookupAppLocalizations(const Locale('ar'));

  AppError problemWithCode(int status, String? code) =>
      ApiProblemError(ApiProblem(status: status, code: code));

  group('describeErrorForUser', () {
    final expectedMessageByCode = {
      'VALIDATION_FAILED': english.errorValidationFailed,
      'UNAUTHENTICATED': english.errorSignInAgain,
      'TOKEN_EXPIRED': english.errorSignInAgain,
      'RATE_LIMITED': english.errorRateLimited,
      'NOT_FOUND': english.errorNotFound,
      'ACCOUNT_DISABLED': english.errorAccountDisabled,
      'INTERNAL': english.errorServerProblem,
      'PREDICTION_LOCKED': english.errorPredictionLocked,
      'MATCH_NOT_PREDICTABLE': english.errorMatchNotPredictable,
      'PREDICTION_INVALID_PICKS': english.errorPredictionInvalidPicks,
      'TEAM_NOT_FOUND': english.errorTeamNotFound,
    };

    for (final MapEntry(key: code, value: message)
        in expectedMessageByCode.entries) {
      test('describes $code', () {
        expect(
          describeErrorForUser(problemWithCode(400, code), english),
          message,
        );
      });
    }

    test('falls back to the HTTP status for an unknown code', () {
      expect(
        describeErrorForUser(problemWithCode(409, 'BRAND_NEW_CODE'), english),
        english.errorConflict,
      );
      expect(
        describeErrorForUser(problemWithCode(503, null), english),
        english.errorServerProblem,
      );
      expect(
        describeErrorForUser(problemWithCode(418, 'TEAPOT'), english),
        english.errorUnexpected,
      );
    });

    test('describes network failures', () {
      expect(
        describeErrorForUser(const ServerUnreachableError(), english),
        english.errorServerUnreachable,
      );
      expect(
        describeErrorForUser(const RequestTimedOutError(), english),
        english.errorRequestTimedOut,
      );
      expect(
        describeErrorForUser(StateError('bug'), english),
        english.errorUnexpected,
      );
    });

    test('uses the given language', () {
      expect(
        describeErrorForUser(problemWithCode(404, 'NOT_FOUND'), arabic),
        arabic.errorNotFound,
      );
      expect(arabic.errorNotFound, isNot(english.errorNotFound));
    });
  });
}
