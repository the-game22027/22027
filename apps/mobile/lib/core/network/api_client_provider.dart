import 'package:api_client/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/network/auth_interceptor.dart';
import 'package:the_game/core/network/request_headers_interceptor.dart';
import 'package:the_game/core/network/safe_logging_interceptor.dart';
import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:uuid/uuid.dart';

/// Tests override this with a fake adapter; production uses Dio's default one.
final httpClientAdapterProvider = Provider<HttpClientAdapter?>((ref) => null);

/// Dio for every request that does not need the session: the token refresh itself, and
/// retries after a refresh (see [AuthInterceptor.retryDio]).
final dioWithoutAuthProvider = Provider<Dio>(
  (ref) => _createDioWithHeadersAndLogging(ref, addAuthInterceptor: null),
);

final dioProvider = Provider<Dio>(
  (ref) => _createDioWithHeadersAndLogging(
    ref,
    addAuthInterceptor: (interceptors) => interceptors.add(
      AuthInterceptor(
        retryDio: ref.watch(dioWithoutAuthProvider),
        readSession: () => ref.read(sessionControllerProvider).value,
        startSession: (session) =>
            ref.read(sessionControllerProvider.notifier).startSession(session),
        endSession: () =>
            ref.read(sessionControllerProvider.notifier).endSession(),
        accessTokenRefresher: ref.watch(accessTokenRefresherProvider),
      ),
    ),
  ),
);

Dio _createDioWithHeadersAndLogging(
  Ref ref, {
  required void Function(Interceptors interceptors)? addAuthInterceptor,
}) {
  final config = ref.watch(appConfigProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );
  final adapter = ref.watch(httpClientAdapterProvider);
  if (adapter != null) dio.httpClientAdapter = adapter;

  const uuid = Uuid();
  dio.interceptors.add(
    RequestHeadersInterceptor(
      readLanguageCode: () => ref.read(appLanguageControllerProvider).code,
      createRequestId: uuid.v4,
    ),
  );
  addAuthInterceptor?.call(dio.interceptors);
  if (config.isDevFlavor) {
    dio.interceptors.add(
      SafeLoggingInterceptor(writeLogLine: (line) => debugPrint(line)),
    );
  }
  return dio;
}

/// The generated REST client (`packages/api_client`). Only feature `data/` layers use it.
final apiClientProvider = Provider<ApiClient>(
  // An empty interceptor list stops the generated client from adding its own auth interceptors.
  (ref) => ApiClient(dio: ref.watch(dioProvider), interceptors: const []),
);

/// The generated client without session handling, for the token refresh call.
final apiClientWithoutAuthProvider = Provider<ApiClient>(
  (ref) =>
      ApiClient(dio: ref.watch(dioWithoutAuthProvider), interceptors: const []),
);
