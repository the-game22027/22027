import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/account/application/keep_signed_in_account.dart';
import 'package:the_game/features/account/data/auth_repository.dart';

/// State of the dev sign-in form: idle/data, loading while the request runs, error to show.
class DevSignInController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> signIn({required String subject, String? displayName}) async {
    state = const AsyncLoading();
    final result = await AsyncValue.guard(() async {
      final account = await ref
          .read(authRepositoryProvider)
          .signInWithDevAccount(subject: subject, displayName: displayName);
      await keepSignedInAccount(ref, account);
    });
    // On success the router has already left the screen, which disposes this controller.
    if (ref.mounted) state = result;
  }
}

final devSignInControllerProvider =
    NotifierProvider.autoDispose<DevSignInController, AsyncValue<void>>(
      DevSignInController.new,
    );
