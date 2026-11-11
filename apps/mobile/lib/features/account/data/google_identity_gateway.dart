import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:the_game/core/config/app_config.dart';

sealed class GoogleIdentityResult {
  const GoogleIdentityResult();
}

class GoogleIdTokenReceived extends GoogleIdentityResult {
  const GoogleIdTokenReceived(this.idToken);

  final String idToken;
}

/// The player closed the account picker. Not an error: show nothing.
class GoogleSignInCancelled extends GoogleIdentityResult {
  const GoogleSignInCancelled();
}

/// Google could not give us an ID token (no Google account on the device, wrong client
/// configuration, Play services missing).
class GoogleSignInUnavailable extends GoogleIdentityResult {
  const GoogleSignInUnavailable(this.reason);

  final String reason;
}

/// Port over the `google_sign_in` plugin, so tests never open the real account picker.
abstract interface class GoogleIdentityGateway {
  Future<GoogleIdentityResult> requestGoogleIdToken();

  /// Forgets the chosen Google account, so the next sign-in shows the account picker again.
  Future<void> forgetGoogleAccount();
}

class PluginGoogleIdentityGateway implements GoogleIdentityGateway {
  PluginGoogleIdentityGateway({required this.serverClientId});

  final String serverClientId;
  Future<void>? _initialization;

  // The plugin must be initialized exactly once per app run.
  Future<void> _initializeOnce() => _initialization ??= GoogleSignIn.instance
      .initialize(serverClientId: serverClientId);

  @override
  Future<GoogleIdentityResult> requestGoogleIdToken() async {
    try {
      await _initializeOnce();
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      return idToken == null
          ? const GoogleSignInUnavailable('no ID token returned')
          : GoogleIdTokenReceived(idToken);
    } on GoogleSignInException catch (exception) {
      return switch (exception.code) {
        GoogleSignInExceptionCode.canceled ||
        GoogleSignInExceptionCode.interrupted => const GoogleSignInCancelled(),
        _ => GoogleSignInUnavailable(exception.code.name),
      };
    }
  }

  @override
  Future<void> forgetGoogleAccount() async {
    if (_initialization == null) return;
    await GoogleSignIn.instance.signOut();
  }
}

final googleIdentityGatewayProvider = Provider<GoogleIdentityGateway>(
  (ref) => PluginGoogleIdentityGateway(
    serverClientId: ref.watch(appConfigProvider).googleServerClientId,
  ),
);
