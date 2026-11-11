import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/account/application/keep_signed_in_account.dart';
import 'package:the_game/features/account/data/auth_repository.dart';
import 'package:the_game/features/account/data/google_identity_gateway.dart';

/// Google could not provide an ID token on this device (shown with its own message).
class GoogleSignInUnavailableError implements Exception {
  const GoogleSignInUnavailableError(this.reason);

  final String reason;

  @override
  String toString() => 'GoogleSignInUnavailableError($reason)';
}

class GoogleSignInController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> signInWithGoogle() async {
    state = const AsyncLoading();
    final result = await AsyncValue.guard(() async {
      final identity = await ref
          .read(googleIdentityGatewayProvider)
          .requestGoogleIdToken();
      switch (identity) {
        case GoogleSignInCancelled():
          return;
        case GoogleSignInUnavailable(:final reason):
          throw GoogleSignInUnavailableError(reason);
        case GoogleIdTokenReceived(:final idToken):
          final account = await ref
              .read(authRepositoryProvider)
              .signInWithGoogle(idToken: idToken);
          await keepSignedInAccount(ref, account);
      }
    });
    if (ref.mounted) state = result;
  }
}

final googleSignInControllerProvider =
    NotifierProvider.autoDispose<GoogleSignInController, AsyncValue<void>>(
      GoogleSignInController.new,
    );
