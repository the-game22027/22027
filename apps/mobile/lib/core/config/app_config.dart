import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppFlavor { dev, prod }

/// Thrown at startup when `config/<flavor>.json` misses a value or holds a bad one.
class InvalidAppConfigError extends Error {
  InvalidAppConfigError(this.message);

  final String message;

  @override
  String toString() => 'InvalidAppConfigError: $message';
}

/// Values passed at build time with `--dart-define-from-file=config/<flavor>.json`.
class AppConfig {
  const AppConfig({required this.flavor, required this.apiBaseUrl});

  /// Validates raw values and fails fast, so a bad build never reaches a screen.
  factory AppConfig.fromValues({
    required String flavor,
    required String apiBaseUrl,
  }) {
    final parsedFlavor = AppFlavor.values.asNameMap()[flavor];
    if (parsedFlavor == null) {
      throw InvalidAppConfigError(
        'flavor must be one of ${AppFlavor.values.map((f) => f.name)}, got "$flavor". '
        'Run with --dart-define-from-file=config/<flavor>.json',
      );
    }
    final parsedUrl = Uri.tryParse(apiBaseUrl);
    if (apiBaseUrl.isEmpty ||
        parsedUrl == null ||
        !parsedUrl.hasScheme ||
        parsedUrl.host.isEmpty) {
      throw InvalidAppConfigError(
        'apiBaseUrl must be an absolute URL, got "$apiBaseUrl"',
      );
    }
    return AppConfig(flavor: parsedFlavor, apiBaseUrl: apiBaseUrl);
  }

  /// Reads the compile-time values. They are empty strings when the define file was not passed.
  factory AppConfig.fromEnvironment() => AppConfig.fromValues(
    flavor: const String.fromEnvironment('flavor'),
    apiBaseUrl: const String.fromEnvironment('apiBaseUrl'),
  );

  final AppFlavor flavor;
  final String apiBaseUrl;

  bool get isDevFlavor => flavor == AppFlavor.dev;
}

/// Overridden in `main.dart` with the validated config; tests override it with their own.
final appConfigProvider = Provider<AppConfig>(
  (ref) => throw UnimplementedError('appConfigProvider must be overridden'),
);
