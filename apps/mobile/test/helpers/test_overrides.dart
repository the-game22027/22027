import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/account/data/api_access_token_refresher.dart';

import 'in_memory_token_storage.dart';

const devConfig = AppConfig(
  flavor: AppFlavor.dev,
  apiBaseUrl: 'http://api.test',
);
const prodConfig = AppConfig(
  flavor: AppFlavor.prod,
  apiBaseUrl: 'https://api.example.invalid',
);

/// The overrides every app-level test needs: config, preferences, storage and a fake network.
Future<List<Override>> createTestOverrides({
  AppConfig config = devConfig,
  TokenStorage? tokenStorage,
  HttpClientAdapter? httpClientAdapter,
  String? savedLanguageCode,
}) async {
  SharedPreferences.setMockInitialValues({'app_language': ?savedLanguageCode});
  final sharedPreferences = await SharedPreferences.getInstance();
  return [
    appConfigProvider.overrideWithValue(config),
    sharedPreferencesProvider.overrideWithValue(sharedPreferences),
    accessTokenRefresherProvider.overrideWith(
      (ref) => ref.watch(apiAccessTokenRefresherProvider),
    ),
    tokenStorageProvider.overrideWithValue(
      tokenStorage ?? InMemoryTokenStorage(),
    ),
    if (httpClientAdapter != null)
      httpClientAdapterProvider.overrideWithValue(httpClientAdapter),
  ];
}

/// A container with a signed-in player whose requests go to [httpClientAdapter]; disposed
/// after the test.
Future<ProviderContainer> createSignedInTestContainer(
  HttpClientAdapter httpClientAdapter, {
  List<Override> extraOverrides = const [],
}) async {
  final container = ProviderContainer(
    overrides: [
      ...await createTestOverrides(
        tokenStorage: InMemoryTokenStorage(testSession),
        httpClientAdapter: httpClientAdapter,
        savedLanguageCode: 'en',
      ),
      ...extraOverrides,
    ],
  );
  addTearDown(container.dispose);
  await container.read(sessionControllerProvider.future);
  return container;
}
