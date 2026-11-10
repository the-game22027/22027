import 'package:dio/dio.dart';

import 'package:the_game/core/errors/api_problem.dart';

/// Dev-flavor request log. It prints only the method, path, status, duration, request id and
/// problem `code`: never headers or bodies, so tokens cannot leak into logs by construction.
class SafeLoggingInterceptor extends Interceptor {
  SafeLoggingInterceptor({required this.writeLogLine});

  final void Function(String line) writeLogLine;

  static const _startedAtKey = 'loggingStartedAt';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra[_startedAtKey] = DateTime.now();
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    writeLogLine(
      _describeExchange(response.requestOptions, response.statusCode),
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final response = err.response;
    final problemCode = response == null
        ? null
        : ApiProblem.fromResponseBody(
            status: response.statusCode ?? 0,
            body: response.data,
          ).code;
    writeLogLine(
      '${_describeExchange(err.requestOptions, response?.statusCode)} '
      '${problemCode ?? err.type.name}',
    );
    handler.next(err);
  }

  String _describeExchange(RequestOptions options, int? statusCode) {
    final startedAt = options.extra[_startedAtKey];
    final elapsed = startedAt is DateTime
        ? '${DateTime.now().difference(startedAt).inMilliseconds}ms'
        : '?ms';
    return '[http] ${options.method} ${options.uri.path} '
        '→ ${statusCode ?? '-'} $elapsed '
        'requestId=${options.headers['X-Request-Id']}';
  }
}
