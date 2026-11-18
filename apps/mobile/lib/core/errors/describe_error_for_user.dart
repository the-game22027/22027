import 'package:the_game/core/errors/api_problem.dart';
import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

/// A localized, player-facing message for any error. The server's `detail` is never shown:
/// it is English and meant for developers (API §4).
String describeErrorForUser(Object error, AppLocalizations l10n) {
  return switch (error) {
    ApiProblemError(:final problem) => _describeApiProblem(problem, l10n),
    ServerUnreachableError() => l10n.errorServerUnreachable,
    RequestTimedOutError() => l10n.errorRequestTimedOut,
    UnexpectedResponseError() => l10n.errorUnexpected,
    _ => l10n.errorUnexpected,
  };
}

String _describeApiProblem(ApiProblem problem, AppLocalizations l10n) {
  return switch (problem.code) {
    'VALIDATION_FAILED' => l10n.errorValidationFailed,
    'UNAUTHENTICATED' || 'TOKEN_EXPIRED' => l10n.errorSignInAgain,
    'PROVIDER_TOKEN_INVALID' => l10n.errorProviderTokenInvalid,
    'RATE_LIMITED' => l10n.errorRateLimited,
    'NOT_FOUND' => l10n.errorNotFound,
    'ACCOUNT_DISABLED' => l10n.errorAccountDisabled,
    'RECENT_SIGN_IN_REQUIRED' => l10n.errorRecentSignInRequired,
    'PREDICTION_LOCKED' => l10n.errorPredictionLocked,
    'MATCH_NOT_PREDICTABLE' => l10n.errorMatchNotPredictable,
    'PREDICTION_INVALID_PICKS' => l10n.errorPredictionInvalidPicks,
    'TEAM_NOT_FOUND' => l10n.errorTeamNotFound,
    'INTERNAL' => l10n.errorServerProblem,
    _ => _describeHttpStatus(problem.status, l10n),
  };
}

/// Fallback for codes this app version does not know yet (new codes are additive, API §8).
String _describeHttpStatus(int status, AppLocalizations l10n) {
  return switch (status) {
    400 || 422 => l10n.errorValidationFailed,
    401 => l10n.errorSignInAgain,
    403 => l10n.errorNotAllowed,
    404 => l10n.errorNotFound,
    409 => l10n.errorConflict,
    429 => l10n.errorRateLimited,
    >= 500 => l10n.errorServerProblem,
    _ => l10n.errorUnexpected,
  };
}
