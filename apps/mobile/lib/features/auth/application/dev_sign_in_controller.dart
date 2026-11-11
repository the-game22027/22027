import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/auth/data/auth_repository.dart';

/// State of the dev sign-in form: idle/data, loading while the request runs, error to show.
class DevSignInController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> signIn({required String subject, String? displayName}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final session = await ref
          .read(authRepositoryProvider)
          .signInWithDevAccount(subject: subject, displayName: displayName);
      // The router reacts to the new session and leaves the sign-in screen.
      await ref.read(sessionControllerProvider.notifier).startSession(session);
    });
  }
}

final devSignInControllerProvider =
    NotifierProvider.autoDispose<DevSignInController, AsyncValue<void>>(
      DevSignInController.new,
    );
