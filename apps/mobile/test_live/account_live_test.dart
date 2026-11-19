// Sessions, token refresh and account deletion against the local backend, through the app's
// repositories and its auth interceptor. Access tokens stay valid until they expire (15 min,
// 04-auth.md §4), so a revoked session shows up as a refused refresh token, not as a refused
// request. Fresh dev players per test. Run by hand, see README.md.
@Tags(['live'])
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/account/data/api_access_token_refresher.dart';
import 'package:the_game/features/account/data/profile_repository.dart';
import 'package:the_game/features/account/data/sessions_repository.dart';

import 'live_backend.dart';

void main() {
  setUpAll(stopUnlessLiveBackendIsReachable);

  test('sessions: sign another device out, then log this one out', () async {
    final phone = await signInFreshLivePlayer('sessions-revoke');
    final tablet = await phone.signInAgainOnAnotherDevice();
    final sessions = phone.read(sessionsRepositoryProvider);

    final both = await sessions.fetchSignedInSessions();
    expect(both, hasLength(2));
    final tabletSession = both.singleWhere((session) => !session.isThisDevice);

    await sessions.revokeSessionOnServer(tabletSession.id);
    expect(
      (await sessions.fetchSignedInSessions()).map((session) => session.id),
      isNot(contains(tabletSession.id)),
    );
    expect(await _refreshSessionOf(tablet), isA<RefreshRejected>());

    await sessions.revokeCurrentSessionOnServer();
    expect(await _refreshSessionOf(phone), isA<RefreshRejected>());
  });

  test(
    'refresh: a refused access token is refreshed once and the request retried; '
    'the replaced refresh token is then refused',
    () async {
      final player = await signInFreshLivePlayer('refresh');
      final signedIn = player.read(sessionControllerProvider).value!;
      final device = await player.openDeviceWithSession(
        StoredSession(
          accessToken: 'not-a-valid-access-token',
          accessTokenExpiresAt: signedIn.accessTokenExpiresAt,
          refreshToken: signedIn.refreshToken,
        ),
      );

      final profile = await device
          .read(profileRepositoryProvider)
          .fetchPlayerAccountProfile();

      expect(profile.userId, player.userId);
      final refreshed = device.read(sessionControllerProvider).value!;
      expect(refreshed.refreshToken, isNot(signedIn.refreshToken));
      expect(refreshed.accessToken, isNot('not-a-valid-access-token'));
      // Rotation with reuse detection (04-auth.md §4): the old token is spent.
      expect(await _refreshSessionOf(player), isA<RefreshRejected>());
    },
  );

  test('account deletion: accepted, then the session cannot refresh', () async {
    final player = await signInFreshLivePlayer('delete-account');

    await player.read(profileRepositoryProvider).requestAccountDeletion();

    expect(await _refreshSessionOf(player), isA<RefreshRejected>());
  });
}

/// What `POST /v1/auth/refresh` says to the device's current refresh token.
Future<RefreshOutcome> _refreshSessionOf(LivePlayer device) => device
    .read(apiAccessTokenRefresherProvider)
    .refreshAccessToken(device.read(sessionControllerProvider).value!);
