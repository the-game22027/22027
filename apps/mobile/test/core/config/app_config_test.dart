import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/config/app_config.dart';

void main() {
  group('AppConfig.fromValues', () {
    test('accepts a valid dev config', () {
      final config = AppConfig.fromValues(
        flavor: 'dev',
        apiBaseUrl: 'http://localhost:3000',
      );

      expect(config.flavor, AppFlavor.dev);
      expect(config.isDevFlavor, isTrue);
      expect(config.apiBaseUrl, 'http://localhost:3000');
    });

    test('fails when the flavor is missing', () {
      expect(
        () => AppConfig.fromValues(flavor: '', apiBaseUrl: 'http://localhost:3000'),
        throwsA(isA<InvalidAppConfigError>()),
      );
    });

    test('fails on an unknown flavor', () {
      expect(
        () => AppConfig.fromValues(
          flavor: 'staging',
          apiBaseUrl: 'http://localhost:3000',
        ),
        throwsA(isA<InvalidAppConfigError>()),
      );
    });

    test('fails when the API base URL is missing', () {
      expect(
        () => AppConfig.fromValues(flavor: 'prod', apiBaseUrl: ''),
        throwsA(isA<InvalidAppConfigError>()),
      );
    });

    test('fails when the API base URL is not absolute', () {
      expect(
        () => AppConfig.fromValues(flavor: 'prod', apiBaseUrl: 'localhost:3000'),
        throwsA(isA<InvalidAppConfigError>()),
      );
    });
  });
}
