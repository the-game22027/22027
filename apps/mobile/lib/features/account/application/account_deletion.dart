import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/application/google_sign_in_controller.dart';
import 'package:the_game/features/account/data/auth_repository.dart';
import 'package:the_game/features/account/data/google_identity_gateway.dart';
import 'package:the_game/features/account/data/profile_repository.dart';
import 'package:the_game/features/account/data/sessions_repository.dart';

sealed class AccountDeletionOutcome {
  const AccountDeletionOutcome();
}

/// `202`: every device is signed out; the sign-in screen shows a notice.
class AccountDeletionRequested extends AccountDeletionOutcome {
  const AccountDeletionRequested();
}

/// `403 RECENT_SIGN_IN_REQUIRED`: the player must sign in again first (DEC-50).
class ReauthenticationRequired extends AccountDeletionOutcome {
  const ReauthenticationRequired();
}

/// The player closed the provider's sign-in. Nothing changed.
class ReauthenticationCancelled extends AccountDeletionOutcome {
  const ReauthenticationCancelled();
}

/// The re-authentication was another account: nothing was deleted, the current session stays.
class ReauthenticatedAsDifferentAccount extends AccountDeletionOutcome {
  const ReauthenticatedAsDifferentAccount();
}

/// Shown once on the sign-in screen after a deletion request.
class AccountDeletionNoticeController extends Notifier<bool> {
  @override
  bool build() => false;

  void showNotice() => state = true;

  void dismissNotice() => state = false;
}

final accountDeletionNoticeProvider =
    NotifierProvider<AccountDeletionNoticeController, bool>(
      AccountDeletionNoticeController.new,
    );

/// ADR-0017 §6.
class AccountDeletionService {
  AccountDeletionService(this._ref);

  final Ref _ref;

  Future<AccountDeletionOutcome> requestAccountDeletion() async {
    try {
      await _ref.read(profileRepositoryProvider).requestAccountDeletion();
    } on ApiProblemError catch (error) {
      if (error.problem.code == 'RECENT_SIGN_IN_REQUIRED') {
        return const ReauthenticationRequired();
      }
      rethrow;
    }
    await _finishAfterDeletionRequest();
    return const AccountDeletionRequested();
  }

  /// Signs in again with [signInAgain] (null = cancelled) and retries the deletion once, but
  /// only if it is the same player. Signing in as someone else must never delete their account.
  Future<AccountDeletionOutcome> reauthenticateAndRequestAccountDeletion(
    Future<SignedInAccount?> Function() signInAgain,
  ) async {
    final currentUserId =
        (await _ref.read(profileRepositoryProvider).fetchPlayerAccountProfile())
            .userId;

    final account = await signInAgain();
    if (account == null) return const ReauthenticationCancelled();

    if (account.userId != currentUserId) {
      try {
        await _ref
            .read(sessionsRepositoryProvider)
            .revokeSessionOfAccessToken(account.session.accessToken);
      } on AppError {
        // Its refresh token was never stored, so the session simply expires on the server.
      }
      return const ReauthenticatedAsDifferentAccount();
    }

    await _ref
        .read(sessionControllerProvider.notifier)
        .startSession(account.session);
    return requestAccountDeletion();
  }

  Future<AccountDeletionOutcome> reauthenticateWithGoogleAndRequestDeletion() =>
      reauthenticateAndRequestAccountDeletion(() async {
        final identity = await _ref
            .read(googleIdentityGatewayProvider)
            .requestGoogleIdToken();
        return switch (identity) {
          GoogleSignInCancelled() => null,
          GoogleSignInUnavailable(:final reason) =>
            throw GoogleSignInUnavailableError(reason),
          GoogleIdTokenReceived(:final idToken) =>
            await _ref
                .read(authRepositoryProvider)
                .signInWithGoogle(idToken: idToken),
        };
      });

  Future<AccountDeletionOutcome> reauthenticateWithDevAccountAndRequestDeletion(
    String subject,
  ) => reauthenticateAndRequestAccountDeletion(
    () => _ref
        .read(authRepositoryProvider)
        .signInWithDevAccount(subject: subject),
  );

  Future<void> _finishAfterDeletionRequest() async {
    try {
      await _ref.read(googleIdentityGatewayProvider).forgetGoogleAccount();
    } on Object {
      // Only affects which account the picker preselects next time.
    }
    // The server already revoked every session; this forgets the tokens here.
    await _ref.read(sessionControllerProvider.notifier).endSession();
    _ref.read(accountDeletionNoticeProvider.notifier).showNotice();
  }
}

final accountDeletionServiceProvider = Provider<AccountDeletionService>(
  AccountDeletionService.new,
);
