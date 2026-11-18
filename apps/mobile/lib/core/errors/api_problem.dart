import 'dart:convert';

/// One entry of `errors[]` in a `VALIDATION_FAILED` problem.
class ApiFieldError {
  const ApiFieldError({required this.field, this.code, this.message});

  final String field;
  final String? code;
  final String? message;
}

/// An RFC 9457 problem+json body (`docs/api/API.md` §4).
///
/// Parsing never throws: unknown fields are ignored, wrong types become null,
/// and a body that is not problem+json keeps only the HTTP status.
class ApiProblem {
  const ApiProblem({
    required this.status,
    this.code,
    this.title,
    this.detail,
    this.traceId,
    this.requestId,
    this.errors = const [],
  });

  factory ApiProblem.fromResponseBody({
    required int status,
    required Object? body,
  }) {
    final json = _decodeJsonObject(body);
    if (json == null) return ApiProblem(status: status);

    final rawErrors = json['errors'];
    final errors = <ApiFieldError>[
      if (rawErrors is List)
        for (final item in rawErrors)
          if (item is Map && item['field'] is String)
            ApiFieldError(
              field: item['field'] as String,
              code: _readString(item, 'code'),
              message: _readString(item, 'message'),
            ),
    ];

    final bodyStatus = json['status'];
    return ApiProblem(
      status: bodyStatus is int ? bodyStatus : status,
      code: _readString(json, 'code'),
      title: _readString(json, 'title'),
      detail: _readString(json, 'detail'),
      traceId: _readString(json, 'traceId'),
      requestId: _readString(json, 'requestId'),
      errors: errors,
    );
  }

  final int status;

  /// The stable machine contract; null when the body was not problem+json.
  final String? code;
  final String? title;

  /// English, for developers. Never shown to players.
  final String? detail;
  final String? traceId;

  /// Only on `FRIEND_REQUEST_EXISTS`: the request that already exists.
  final String? requestId;
  final List<ApiFieldError> errors;

  @override
  String toString() => 'ApiProblem($status, $code, traceId: $traceId)';
}

Map<Object?, Object?>? _decodeJsonObject(Object? body) {
  if (body is Map) return body;
  if (body is String && body.isNotEmpty) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map) return decoded;
    } on FormatException {
      return null;
    }
  }
  return null;
}

String? _readString(Map<Object?, Object?> json, String key) {
  final value = json[key];
  return value is String ? value : null;
}
