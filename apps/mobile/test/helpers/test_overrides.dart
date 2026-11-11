import 'package:dio/dio.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/storage/token_storage.dart';

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
    tokenStorageProvider.overrideWithValue(
      tokenStorage ?? InMemoryTokenStorage(),
    ),
    if (httpClientAdapter != null)
      httpClientAdapterProvider.overrideWithValue(httpClientAdapter),
  ];
}
