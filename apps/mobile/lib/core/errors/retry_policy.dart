import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';

/// Riverpod 3 retries a failed provider on its own (up to 10 times by default). We retry only
/// failures that can go away by themselves: no network, timeouts, server errors. A 4xx gets the
/// same answer every time, and retrying a 401 would even run after the session has ended.
///
/// Returns the delay before the next attempt, or null to stop and show the error.
Duration? chooseRetryDelayForFailedProvider(int retryCount, Object error) {
  final isTransientFailure = switch (error) {
    ServerUnreachableError() || RequestTimedOutError() => true,
    ApiProblemError(:final problem) => problem.status >= 500,
    _ => false,
  };
  if (!isTransientFailure) return null;
  return ProviderContainer.defaultRetry(retryCount, error, maxRetries: 3);
}
