// MINES (لغم, 08 §10) battles against the bot on the local backend: rock-paper-scissors,
// secret burying, then turns with hearts and the detector. One run drops the socket during
// burying and must come back through battle:resync. Without published MINES rounds the server
// answers NO_CONTENT and both tests are reported as skipped. Run by hand, see README.md.
@Tags(['live'])
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/battle_session_controller.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';

import 'live_backend.dart';
import 'live_battle.dart';

void main() {
  setUpAll(stopUnlessLiveBackendIsReachable);

  test(
    'a MINES battle against the bot: burying, the detector, turns to the end',
    () async {
      final player = await signInFreshLivePlayer('mines');
      final run = LiveBattleRun(player, GameType.mines);
      if (!await _startUnlessNoMinesContent(run)) return;

      final result = await run.waitUntilFinished();

      expectBattleCompletedWithPlacements(run, result);
      _expectMinesBuriedAndScanned(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(run.summarize(result));
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );

  test(
    'a MINES battle survives a dropped socket during burying',
    () async {
      final player = await signInFreshLivePlayer('mines-reconnect');
      final run = LiveBattleRun(
        player,
        GameType.mines,
        dropSocketWhen: (battle) => switch (battle.currentRound) {
          MinesRound(phase: MinesPhase.burying) => true,
          _ => false,
        },
      );
      if (!await _startUnlessNoMinesContent(run)) return;

      final result = await run.waitUntilFinished();

      expect(run.resyncAfterReconnect, isA<BattleCommandAccepted>());
      final restored = run.stateAfterReconnect!;
      expect(restored.phase, BattlePhase.inProgress);
      final restoredRound = restored.currentRound! as MinesRound;
      expect(restoredRound.phase, MinesPhase.burying);
      expect(restoredRound.buryDeadlineAt, isNotNull);
      expect(restoredRound.criteria, hasLength(2));
      expect(restoredRound.wrongTriesLeft, isNotNull);
      expect(run.connectCount, 2);
      expectBattleCompletedWithPlacements(run, result);
      _expectMinesBuriedAndScanned(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(run.summarize(result));
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );
}

/// False, with the test marked skipped, when the bank has no published MINES rounds.
Future<bool> _startUnlessNoMinesContent(LiveBattleRun run) async {
  try {
    await run.start();
  } on TestFailure catch (failure) {
    if (!(failure.message?.contains('NO_CONTENT') ?? false)) rethrow;
    markTestSkipped('no MINES content: the server answered NO_CONTENT');
    return false;
  }
  return true;
}

/// The turns began with the config's number of mines (the server buries any missing ones at
/// the deadline), and the detector's private answer reached the state.
void _expectMinesBuriedAndScanned(
  LiveBattleRun run,
  BattleSessionState result,
) {
  final burying =
      result.battle!.publicConfig['burying']! as Map<String, Object?>;
  expect(run.minesAtFirstTurn, burying['minesPerPlayer']);
  expect(run.scanResult, isNotNull, reason: 'the detector answer');
}
