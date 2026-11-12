// Plays battles against the bot on the LOCAL backend through the app's data layer, with
// no screen (ROADMAP M1.5 exit): one per game type, and one that drops the socket in the
// middle and must come back through battle:resync. Not part of `flutter test`: run it by
// hand with the backend up (`npm run start:api:dev` in the backend worktree):
//
//   fvm flutter test test_live/battle_against_bot_live_test.dart
//
// The dev database needs published content for each game type; without it the server
// answers NO_CONTENT, which the test reports instead of failing silently. Answers are typed
// text (ADR-0021), so the backend needs P6.6.
@Tags(['live'])
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/battles/application/battle_session_controller.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';

import '../test/helpers/in_memory_token_storage.dart';
import '../test/helpers/test_overrides.dart';

const _localApi = 'http://localhost:3000';

/// A guess that is probably wrong, so wrong answers and misses are exercised too.
const _guess = 'Messi';

void main() {
  for (final gameType in [
    GameType.buzzer,
    GameType.career,
    GameType.whoIsPlayer,
    GameType.grid,
  ]) {
    test(
      'a ${convertGameTypeToCode(gameType)} battle against the bot, start to finish',
      () => _playBattleAgainstTheBot(gameType),
      timeout: const Timeout(Duration(minutes: 5)),
    );
  }

  test(
    'a BUZZER battle survives a dropped socket through battle:resync',
    () => _playBattleAgainstTheBot(GameType.buzzer, dropSocketInRound: 2),
    timeout: const Timeout(Duration(minutes: 5)),
  );
}

/// Signs in a fresh dev player, plays one battle and checks it completes. With
/// [dropSocketInRound], the socket disconnects once that round has started and connects
/// again; the battle must still complete with no gap left.
Future<void> _playBattleAgainstTheBot(
  GameType gameType, {
  int? dropSocketInRound,
}) async {
  final container = await _createSignedInContainer(
    'mobile-live-${convertGameTypeToCode(gameType).toLowerCase()}'
    '${dropSocketInRound == null ? '' : '-reconnect'}',
  );
  final controller = container.read(battleSessionProvider.notifier);

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
  final playedGridTurns = <DateTime>{};
  var hasDroppedSocket = false;
  var connectCount = 0;

  container.listen(battleSessionProvider, (previous, session) async {
    if (session.connection != previous?.connection) {
      log.add('socket ${session.connection.name}');
      if (session.connection == BattleSocketStatus.connected) connectCount++;
    }
    if (session.battle?.phase != previous?.battle?.phase) {
      log.add('phase ${session.battle?.phase.name}');
    }
    if (session.lastServerError != null && !finished.isCompleted) {
      finished.complete(session);
    }
    final battle = session.battle;
    if (battle == null) return;
    if (battle.isFinished && !finished.isCompleted) finished.complete(session);
    final round = battle.currentRound;

    if (dropSocketInRound != null &&
        !hasDroppedSocket &&
        round != null &&
        round.roundNo >= dropSocketInRound) {
      hasDroppedSocket = true;
      log.add('dropping the socket in round ${round.roundNo}');
      controller.disconnect();
      await Future<void>.delayed(const Duration(seconds: 2));
      controller.connect();
      return;
    }
    if (session.connection != BattleSocketStatus.connected) return;

    switch (round) {
      case RevealRound()
          when round.revealedClues.length >= 2 &&
              round.buzzHolderParticipantId == null &&
              !round.lockedOutParticipantIds.contains(
                battle.youParticipantId,
              ) &&
              buzzedRounds.add(round.roundNo):
        final buzz = await controller.buzz();
        log.add('buzz round ${round.roundNo}: ${_describe(buzz)}');
        if (buzz is BattleCommandAccepted) {
          final answer = (round.answerKind?.expectsNumber ?? false)
              ? await controller.answerWithNumber(0)
              : await controller.answerWithText(_guess);
          log.add('answer round ${round.roundNo}: ${_describe(answer)}');
        }
      case GridRound(:final turnDeadlineAt?)
          when round.turnParticipantId == battle.youParticipantId &&
              playedGridTurns.add(turnDeadlineAt):
        final freeCell = _findFirstFreeCell(round);
        if (freeCell == null) return;
        final claim = await controller.claimGridCell(freeCell, _guess);
        log.add(
          'claim (${freeCell.row},${freeCell.col}) round ${round.roundNo}: '
          '${_describe(claim)}',
        );
      default:
        break;
    }
  });

  controller.connect();
  await _waitFor(
    container,
    (session) => session.connection == BattleSocketStatus.connected,
  );
  final join = await controller.joinMatchmaking(gameType);
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

  final result = await finished.future.timeout(
    const Duration(minutes: 4),
    onTimeout: () => fail(
      'no end after 4 minutes; '
      'phase ${container.read(battleSessionProvider).battle?.phase}\n'
      '${log.join('\n')}',
    ),
  );
  // ignore: avoid_print
  print(log.join('\n'));
  final error = result.lastServerError;
  if (error != null) fail('server error ${error.code}: ${error.message}');
  final battle = result.battle!;
  // ignore: avoid_print
  print(
    '${convertGameTypeToCode(battle.gameType)}: '
    'clock offset ${result.clock.offset.inMilliseconds} ms; '
    'end ${battle.completion?.endReason}; you ${battle.completion?.yourOutcome}; '
    'scores ${battle.scores}; rounds ${battle.finishedRounds.length}; '
    'connects $connectCount',
  );
  expect(battle.gameType, gameType);
  expect(battle.phase, BattlePhase.completed);
  expect(battle.needsResync, isFalse);
  if (dropSocketInRound != null) expect(connectCount, 2);
}

Future<ProviderContainer> _createSignedInContainer(String subject) async {
  final signIn = await Dio().post<Map<String, Object?>>(
    '$_localApi/v1/_dev/auth/sign-in',
    data: {
      'subject': subject,
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
  final container = ProviderContainer(
    overrides: [
      ...await createTestOverrides(
        config: const AppConfig(flavor: AppFlavor.dev, apiBaseUrl: _localApi),
        tokenStorage: InMemoryTokenStorage(session),
        savedLanguageCode: 'en',
      ),
    ],
  );
  addTearDown(container.dispose);
  await container.read(sessionControllerProvider.future);
  return container;
}

GridCell? _findFirstFreeCell(GridRound round) {
  for (var row = 0; row < round.rows.length; row++) {
    for (var col = 0; col < round.cols.length; col++) {
      final cell = GridCell(row: row, col: col);
      if (!round.cellOwners.containsKey(cell)) return cell;
    }
  }
  return null;
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
