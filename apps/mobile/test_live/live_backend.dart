/// Shared pieces of the live check (`test_live/`): the backend URL, a reachability check, and
/// fresh dev players whose providers are the app's real ones (Dio, the generated client, the
/// Socket.IO connection). Only device-bound pieces are swapped: secure storage (in memory) and
/// shared preferences (mocked).
library;

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/account/application/dev_sign_in_controller.dart';
import 'package:the_game/features/account/data/profile_repository.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';

import '../test/helpers/in_memory_token_storage.dart';
import '../test/helpers/test_overrides.dart';

/// Points the live check at another backend than `config/dev.json`.
const liveApiBaseUrlVariable = 'LIVE_API_BASE_URL';

String readLiveApiBaseUrl() {
  final override = Platform.environment[liveApiBaseUrlVariable];
  if (override != null && override.isNotEmpty) return override;
  final config =
      jsonDecode(File('config/dev.json').readAsStringSync())
          as Map<String, Object?>;
  return config['apiBaseUrl']! as String;
}

/// Call from `setUpAll`: without a backend, the file stops here with one message instead of
/// every test failing on its own network error.
Future<void> stopUnlessLiveBackendIsReachable() async {
  final healthUrl = '${readLiveApiBaseUrl()}/health/ready';
  try {
    await Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 3),
        receiveTimeout: const Duration(seconds: 3),
      ),
    ).get<Object?>(healthUrl);
  } on DioException catch (error) {
    fail(
      'The live check needs the backend: $healthUrl answered '
      '${error.response?.statusCode ?? error.type.name}. Start it with '
      '`npm run start:api:dev` in apps/backend, or set $liveApiBaseUrlVariable.',
    );
  }
}

/// A signed-in dev player with their own provider container (one device).
class LivePlayer {
  LivePlayer._({
    required this.container,
    required this.subject,
    required this.userId,
    required this.displayName,
    required this.unreadableEvents,
  });

  final ProviderContainer container;

  /// The dev sign-in subject: signing in with it again is the same account.
  final String subject;
  final String userId;
  final String displayName;

  /// Socket events the app could not read, each with its `FormatException` and payload.
  final List<String> unreadableEvents;

  T read<T>(ProviderListenable<T> provider) => container.read(provider);

  /// The same account on a second device: a new container that starts from this one's tokens,
  /// like the app after a restart.
  Future<LivePlayer> openSecondDevice() =>
      openDeviceWithSession(read(sessionControllerProvider).value!);

  /// The same account on a device that starts from [session], for example one whose access
  /// token the server refuses.
  Future<LivePlayer> openDeviceWithSession(StoredSession session) async {
    final unreadableEvents = <String>[];
    final container = await _createLiveContainer(session, unreadableEvents);
    await container.read(sessionControllerProvider.future);
    return LivePlayer._(
      container: container,
      subject: subject,
      userId: userId,
      displayName: displayName,
      unreadableEvents: unreadableEvents,
    );
  }

  /// The same account signed in again on another device: a separate server session.
  Future<LivePlayer> signInAgainOnAnotherDevice() =>
      _signInLivePlayer(subject: subject, displayName: displayName);
}

/// Signs in a new dev account through the app's dev sign-in. The subject and display name are
/// unique per call, so runs never share a player or leftover state.
Future<LivePlayer> signInFreshLivePlayer(String label) {
  final uniqueId = DateTime.now().microsecondsSinceEpoch.toString();
  return _signInLivePlayer(
    subject: 'live-$label-$uniqueId',
    displayName: 'Live $label ${uniqueId.substring(uniqueId.length - 9)}',
  );
}

Future<LivePlayer> _signInLivePlayer({
  required String subject,
  required String displayName,
}) async {
  final unreadableEvents = <String>[];
  final container = await _createLiveContainer(null, unreadableEvents);
  await container.read(sessionControllerProvider.future);

  final keepAlive = container.listen(devSignInControllerProvider, (_, _) {});
  await container
      .read(devSignInControllerProvider.notifier)
      .signIn(subject: subject, displayName: displayName);
  final signIn = container.read(devSignInControllerProvider);
  keepAlive.close();
  if (signIn.hasError) {
    fail('dev sign-in failed: ${signIn.error}');
  }

  final profile = await container
      .read(profileRepositoryProvider)
      .fetchPlayerAccountProfile();
  return LivePlayer._(
    container: container,
    subject: subject,
    userId: profile.userId,
    displayName: profile.displayName,
    unreadableEvents: unreadableEvents,
  );
}

Future<ProviderContainer> _createLiveContainer(
  StoredSession? session,
  List<String> unreadableEvents,
) async {
  final apiBaseUrl = readLiveApiBaseUrl();
  final container = ProviderContainer(
    overrides: [
      ...await createTestOverrides(
        config: AppConfig(flavor: AppFlavor.dev, apiBaseUrl: apiBaseUrl),
        tokenStorage: InMemoryTokenStorage(session),
        savedLanguageCode: 'en',
      ),
      // The real connection, recording what it could not read instead of only logging it.
      battleSocketConnectionProvider.overrideWith((ref) {
        final connection = SocketIoBattleConnection(
          apiBaseUrl: apiBaseUrl,
          readAccessToken: () =>
              ref.read(sessionControllerProvider).value?.accessToken,
          onUnreadableEvent: (eventName, payload, error) => unreadableEvents
              .add('${error.message}\n  payload: ${jsonEncode(payload)}'),
        );
        ref.onDispose(connection.dispose);
        return connection;
      }),
    ],
  );
  addTearDown(container.dispose);
  return container;
}
