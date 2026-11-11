import 'package:dio/dio.dart';

/// Adds the headers every request carries (API §1): the app language and a fresh request id,
/// so a player's bug report can be matched to one line in the backend logs.
class RequestHeadersInterceptor extends Interceptor {
  RequestHeadersInterceptor({
    required this.readLanguageCode,
    required this.createRequestId,
  });

  final String Function() readLanguageCode;
  final String Function() createRequestId;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['Accept-Language'] = readLanguageCode();
    options.headers['X-Request-Id'] = createRequestId();
    handler.next(options);
  }
}
