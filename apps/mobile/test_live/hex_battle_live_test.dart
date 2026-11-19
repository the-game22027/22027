// HEX (الهجمة, 08 §13) battles against the bot on the local backend: rock-paper-scissors for
// the first pick and the sides, then picks, races on each cell's question with lockouts, one
// clear ("شيلها") when the bot owns a cell, until a player connects their sides or maxPicks
// runs out. One run drops the socket during a race and must come back through battle:resync.
// Without published HEX boards the server answers NO_CONTENT and both tests are reported as
// skipped. Run by hand, see README.md.
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
    'a HEX battle against the bot: picks, races, a clear, to the end of the board',
    () async {
      final player = await signInFreshLivePlayer('hex');
      final run = LiveBattleRun(player, GameType.hex);
      if (!await _startUnlessNoHexContent(run)) return;

      final result = await run.waitUntilFinished(
        timeout: const Duration(minutes: 9),
      );

      expectBattleCompletedWithPlacements(run, result);
      _expectHexRacesAndReveal(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(_summarizeHex(run, result));
    },
    timeout: const Timeout(Duration(minutes: 10)),
  );

  test(
    'a HEX battle survives a dropped socket during a race',
    () async {
      final player = await signInFreshLivePlayer('hex-reconnect');
      final run = LiveBattleRun(
        player,
        GameType.hex,
        dropSocketWhen: (battle) => switch (battle.currentRound) {
          HexRound(phase: HexPhase.racing) => true,
          _ => false,
        },
      );
      if (!await _startUnlessNoHexContent(run)) return;

      final result = await run.waitUntilFinished(
        timeout: const Duration(minutes: 9),
      );

      expect(run.resyncAfterReconnect, isA<BattleCommandAccepted>());
      final restored = run.stateAfterReconnect!;
      expect(restored.phase, BattlePhase.inProgress);
      final restoredRound = restored.currentRound! as HexRound;
      expect(
        restoredRound.board,
        hasLength(restoredRound.size * restoredRound.size),
      );
      expect(restoredRound.owners, hasLength(restoredRound.board.length));
      expect(
        restoredRound.sides.keys,
        containsAll(restored.players.map((p) => p.participantId)),
      );
      expect(run.connectCount, 2);
      expectBattleCompletedWithPlacements(run, result);
      _expectHexRacesAndReveal(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(_summarizeHex(run, result));
    },
    timeout: const Timeout(Duration(minutes: 10)),
  );
}

/// False, with the test marked skipped, when the bank has no published HEX boards.
Future<bool> _startUnlessNoHexContent(LiveBattleRun run) async {
  try {
    await run.start();
  } on TestFailure catch (failure) {
    if (!(failure.message?.contains('NO_CONTENT') ?? false)) rethrow;
    markTestSkipped('no HEX content: the server answered NO_CONTENT');
    return false;
  }
  return true;
}

/// Races happened; a wrong name of this device was followed by the `LOCKED_OUT` refusal of the
/// answer sent at once; a clear, when sent, raced the cleared cell; the board revealed its end.
void _expectHexRacesAndReveal(LiveBattleRun run, BattleSessionState result) {
  expect(run.hexRaces, greaterThan(0), reason: 'no race started');
  if (run.hexWrongAnswers > 0) {
    expect(run.hexRefusals, contains('LOCKED_OUT'));
  }
  if (run.hexClearResult is BattleCommandAccepted) {
    expect(
      run.hexClearedRaces,
      greaterThan(0),
      reason: 'the clear raced no cell',
    );
  }
  final board = result.battle!.finishedRounds.single.reveal;
  expect(['CONNECTED', 'MAX_PICKS'], contains(board['outcome']));
  expect(board['owners'], isA<List<Object?>>());
  if (board['outcome'] == 'CONNECTED') expect(board['path'], isNotEmpty);
}

String _summarizeHex(LiveBattleRun run, BattleSessionState result) =>
    '${run.summarize(result)}, '
    'outcome ${result.battle!.finishedRounds.single.reveal['outcome']}, '
    'races ${run.hexRaces} (cleared ${run.hexClearedRaces}), '
    'your wrong names ${run.hexWrongAnswers}, refusals ${run.hexRefusals.join('/')}';
