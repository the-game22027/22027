import 'package:the_game/core/errors/app_error.dart';

/// Reads an ISO-8601 UTC timestamp from the API (API §1). A malformed value breaks the
/// contract, so it becomes an [UnexpectedResponseError] instead of a `FormatException`.
DateTime parseServerTimestamp(String value) {
  final timestamp = DateTime.tryParse(value);
  if (timestamp == null) {
    throw UnexpectedResponseError('invalid timestamp: $value');
  }
  return timestamp.toUtc();
}

DateTime? parseOptionalServerTimestamp(String? value) =>
    value == null ? null : parseServerTimestamp(value);
