import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';

import '../../helpers/in_memory_token_storage.dart';

class _BrokenTokenStorage extends InMemoryTokenStorage {
  bool wasDeleted = false;

  @override
  Future<StoredSession?> readSession() async =>
      throw Exception('keystore entry cannot be decrypted');

  @override
  Future<void> deleteSession() async => wasDeleted = true;
}

void main() {
  ProviderContainer createContainer(TokenStorage storage) {
    final container = ProviderContainer(
      overrides: [tokenStorageProvider.overrideWithValue(storage)],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('restores a stored session at startup', () async {
    final container = createContainer(InMemoryTokenStorage(testSession));

    final session = await container.read(sessionControllerProvider.future);

    expect(session?.accessToken, testSession.accessToken);
  });

  test('starts signed out when storage is empty', () async {
    final container = createContainer(InMemoryTokenStorage());

    expect(await container.read(sessionControllerProvider.future), isNull);
  });

  test('starts signed out and clears storage when it cannot be read', () async {
    final storage = _BrokenTokenStorage();
    final container = createContainer(storage);

    expect(await container.read(sessionControllerProvider.future), isNull);
    expect(storage.wasDeleted, isTrue);
  });

  test('startSession saves the tokens, endSession deletes them', () async {
    final storage = InMemoryTokenStorage();
    final container = createContainer(storage);
    await container.read(sessionControllerProvider.future);
    final controller = container.read(sessionControllerProvider.notifier);

    await controller.startSession(testSession);
    expect(storage.session, same(testSession));
    expect(container.read(sessionControllerProvider).value, same(testSession));

    await controller.endSession();
    expect(storage.session, isNull);
    expect(container.read(sessionControllerProvider).value, isNull);
  });

  test('a new container (an app restart) sees the saved session', () async {
    final storage = InMemoryTokenStorage();
    final firstRun = createContainer(storage);
    await firstRun.read(sessionControllerProvider.future);
    await firstRun
        .read(sessionControllerProvider.notifier)
        .startSession(testSession);

    final secondRun = createContainer(storage);

    expect(
      (await secondRun.read(sessionControllerProvider.future))?.accessToken,
      testSession.accessToken,
    );
  });
}
