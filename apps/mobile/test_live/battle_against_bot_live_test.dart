// Plays one battle against the bot on the LOCAL backend through the app's data layer, with
// no screen (ROADMAP M1.5 exit). Not part of `flutter test`: run it by hand with the
// backend up (`npm run start:api:dev` in the backend worktree):
//
//   fvm flutter test test_live/battle_against_bot_live_test.dart
//
// The dev database needs published BUZZER content; without it the server answers
// NO_CONTENT, which the test reports instead of failing silently.
@Tags(['live'])
library;

import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/battles/application/answer_catalog_controller.dart';
import 'package:the_game/features/battles/application/battle_session_controller.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/answer_catalog_data_sources.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';

import '../test/helpers/in_memory_token_storage.dart';
import '../test/helpers/test_overrides.dart';

const _localApi = 'http://localhost:3000';

void main() {
  test(
    'a BUZZER battle against the bot, start to finish',
    () async {
      final signIn = await Dio().post<Map<String, Object?>>(
        '$_localApi/v1/_dev/auth/sign-in',
        data: {
          'subject': 'mobile-live-battle',
          'device': {'platform': 'android', 'name': 'live test'},
        },
      );
      final tokens = signIn.data!;
      final session = StoredSession(
        accessToken: tokens['accessToken']! as String,
        accessTokenExpiresAt: DateTime.parse(
          tokens['accessTokenExpiresAt']! as String,
        ),
        refreshToken: tokens['refreshToken']! as String,
      );

      final catalogDirectory = await Directory.systemTemp.createTemp('live');
      addTearDown(() => catalogDirectory.delete(recursive: true));
      final container = ProviderContainer(
        overrides: [
          ...await createTestOverrides(
            config: const AppConfig(
              flavor: AppFlavor.dev,
              apiBaseUrl: _localApi,
            ),
            tokenStorage: InMemoryTokenStorage(session),
            savedLanguageCode: 'en',
          ),
          answerCatalogFileStoreProvider.overrideWithValue(
            AnswerCatalogFileStore(() async => catalogDirectory),
          ),
        ],
      );
      addTearDown(container.dispose);
      await container.read(sessionControllerProvider.future);

      final catalog = await container
          .read(answerCatalogProvider.notifier)
          .revalidateBeforePlaying();
      printOnFailure('catalog ${catalog.version}: ${catalog.entities.length}');

      final log = <String>[];
      container
          .read(battleSocketConnectionProvider)
          .events
          .listen(
            (event) => log.add(
              '${event.seq ?? '-'} ${event.runtimeType}'
              '${event is BattleServerError ? ' ${event.code}' : ''}',
            ),
          );
      final finished = Completer<BattleSessionState>();
      final buzzedRounds = <int>{};
      container.listen(battleSessionProvider, (_, session) async {
        final controller = container.read(battleSessionProvider.notifier);
        final battle = session.battle;
        if (session.lastServerError != null && !finished.isCompleted) {
          finished.complete(session);
        }
        if (battle == null) return;
        if (battle.isFinished && !finished.isCompleted) {
          finished.complete(session);
        }
        final round = battle.currentRound;
        // Buzz once per round after the second clue, and answer with the most popular
        // suggestion for "a": probably wrong, which exercises round:wrong too.
        if (round is RevealRound &&
            round.revealedClues.length >= 2 &&
            round.buzzHolderParticipantId == null &&
            !round.lockedOutParticipantIds.contains(battle.youParticipantId) &&
            buzzedRounds.add(round.roundNo)) {
          final buzz = await controller.buzz();
          log.add('buzz round ${round.roundNo}: ${_describe(buzz)}');
          if (buzz is BattleCommandAccepted) {
            final kind = round.answerKind?.entityKind;
            final guess = kind == null
                ? null
                : catalog.findSuggestions('a', kinds: {kind}).firstOrNull;
            final answer = guess == null
                ? await controller.answerWithNumber(0)
                : await controller.answerWithEntity(guess.id);
            log.add('answer round ${round.roundNo}: ${_describe(answer)}');
          }
        }
      });

      final controller = container.read(battleSessionProvider.notifier)
        ..connect();
      await _waitFor(
        container,
        (session) => session.connection == BattleSocketStatus.connected,
      );
      final join = await controller.joinMatchmaking(GameType.buzzer);
      log.add('join: ${_describe(join)}');
      if (join is BattleCommandRejected) {
        fail('matchmaking:join was refused: ${join.code}\n${log.join('\n')}');
      }
      await _waitFor(
        container,
        (session) => session.battle != null || session.lastServerError != null,
      );
      if (container.read(battleSessionProvider).battle != null) {
        log.add('ready: ${_describe(await controller.markReady())}');
      }

      final result = await finished.future.timeout(const Duration(minutes: 4));
      // ignore: avoid_print
      print(log.join('\n'));
      final error = result.lastServerError;
      if (error != null) fail('server error ${error.code}: ${error.message}');
      final battle = result.battle!;
      // ignore: avoid_print
      print(
        'clock offset ${result.clock.offset.inMilliseconds} ms; '
        'end ${battle.completion?.endReason}; you ${battle.completion?.yourOutcome}; '
        'scores ${battle.scores}; rounds ${battle.finishedRounds.length}',
      );
      expect(battle.phase, BattlePhase.completed);
      expect(battle.needsResync, isFalse);
    },
    timeout: const Timeout(Duration(minutes: 5)),
  );
}

String _describe(BattleCommandResult result) => switch (result) {
  BattleCommandAccepted() => 'accepted',
  BattleCommandRejected(:final code) => 'rejected $code',
};

Future<void> _waitFor(
  ProviderContainer container,
  bool Function(BattleSessionState session) isReached,
) {
  if (isReached(container.read(battleSessionProvider))) return Future.value();
  final reached = Completer<void>();
  final subscription = container.listen(battleSessionProvider, (_, session) {
    if (isReached(session) && !reached.isCompleted) reached.complete();
  });
  return reached.future
      .timeout(const Duration(seconds: 30))
      .whenComplete(subscription.close);
}
