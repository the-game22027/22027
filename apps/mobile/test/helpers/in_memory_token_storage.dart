import 'package:the_game/core/storage/token_storage.dart';

class InMemoryTokenStorage implements TokenStorage {
  InMemoryTokenStorage([this.session]);

  StoredSession? session;

  @override
  Future<StoredSession?> readSession() async => session;

  @override
  Future<void> writeSession(StoredSession newSession) async =>
      session = newSession;

  @override
  Future<void> deleteSession() async => session = null;
}

final testSession = StoredSession(
  accessToken: 'test-access-token',
  accessTokenExpiresAt: DateTime.utc(2030),
  refreshToken: 'test-refresh-token',
);
