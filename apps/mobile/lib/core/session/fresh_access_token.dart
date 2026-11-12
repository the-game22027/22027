import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/session/session_controller.dart';

/// Returns an access token the server accepts, or `null` when the player is signed out.
///
/// For connections that cannot refresh by themselves (the battle socket checks the token
/// only in its handshake). It sends one cheap authenticated request: when the token has
/// expired, the auth interceptor refreshes it. Refreshing anywhere else could present the
/// same refresh token twice and revoke the whole session family (ADR-0017).
Future<String?> obtainFreshAccessToken(Ref ref) async {
  try {
    await ref.read(dioProvider).get<void>('/v1/me');
  } on DioException {
    // A refused refresh already ended the session; a network error leaves the token as is.
  }
  return ref.read(sessionControllerProvider).value?.accessToken;
}
