import 'package:the_game/core/errors/api_problem.dart';
import 'package:the_game/core/errors/app_error.dart';

/// A server refusal the app knows by its problem+json `code`, as a feature enum [reason]
/// instead of a string. The [problem] is kept for the status and `traceId`.
class KnownProblemError<Reason extends Enum> implements Exception {
  const KnownProblemError(this.reason, this.problem);

  final Reason reason;
  final ApiProblem problem;

  @override
  String toString() => 'KnownProblemError($reason, $problem)';
}

/// Runs [request]; an [ApiProblemError] whose `code` [findReason] knows becomes a
/// [KnownProblemError]. Any other failure is rethrown unchanged.
Future<T> convertKnownProblems<T, Reason extends Enum>(
  Future<T> Function() request,
  Reason? Function(ApiProblem problem) findReason,
) async {
  try {
    return await request();
  } on ApiProblemError catch (error) {
    final reason = findReason(error.problem);
    if (reason == null) rethrow;
    throw KnownProblemError<Reason>(reason, error.problem);
  }
}

/// Looks [code] up in [reasonsByCode]; `null` when the problem has no code or an unknown one.
Reason? findReasonByCode<Reason extends Enum>(
  ApiProblem problem,
  Map<String, Reason> reasonsByCode,
) => reasonsByCode[problem.code];
