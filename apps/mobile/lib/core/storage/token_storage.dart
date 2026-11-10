import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The tokens of the signed-in player, as returned in `AuthTokens` (API §5).
class StoredSession {
  const StoredSession({
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
  });

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String refreshToken;

  // Never print tokens, even in debug logs.
  @override
  String toString() =>
      'StoredSession(accessTokenExpiresAt: $accessTokenExpiresAt)';
}

/// Port so tests can replace the platform keystore with memory.
abstract interface class TokenStorage {
  Future<StoredSession?> readSession();
  Future<void> writeSession(StoredSession session);
  Future<void> deleteSession();
}

/// Keeps tokens in the Android Keystore / iOS Keychain through `flutter_secure_storage`.
class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'access_token';
  static const _accessTokenExpiresAtKey = 'access_token_expires_at';
  static const _refreshTokenKey = 'refresh_token';

  @override
  Future<StoredSession?> readSession() async {
    final values = await _storage.readAll();
    final accessToken = values[_accessTokenKey];
    final expiresAt = DateTime.tryParse(values[_accessTokenExpiresAtKey] ?? '');
    final refreshToken = values[_refreshTokenKey];
    if (accessToken == null || expiresAt == null || refreshToken == null) {
      return null;
    }
    return StoredSession(
      accessToken: accessToken,
      accessTokenExpiresAt: expiresAt,
      refreshToken: refreshToken,
    );
  }

  @override
  Future<void> writeSession(StoredSession session) async {
    await _storage.write(key: _accessTokenKey, value: session.accessToken);
    await _storage.write(
      key: _accessTokenExpiresAtKey,
      value: session.accessTokenExpiresAt.toUtc().toIso8601String(),
    );
    await _storage.write(key: _refreshTokenKey, value: session.refreshToken);
  }

  @override
  Future<void> deleteSession() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _accessTokenExpiresAtKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => SecureTokenStorage(const FlutterSecureStorage()),
);
