// GRID battles against the bot on the local backend: rock-paper-scissors decides who starts
// (08 §9.1), then turns. One run drops the socket during rock-paper-scissors and must come
// back through battle:resync. Run by hand, see test_live/README.md.
@Tags(['live'])
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';

import 'live_backend.dart';
import 'live_battle.dart';

void main() {
  setUpAll(stopUnlessLiveBackendIsReachable);

  test(
    'a GRID battle against the bot: rock-paper-scissors, then turns to the end',
    () async {
      final player = await signInFreshLivePlayer('grid');
      final run = LiveBattleRun(player, GameType.grid);
      final found = await run.start();

      final result = await run.waitUntilFinished();

      expectBattleCompletedWithPlacements(run, result);
      _expectOwnPickReachedTheServer(run, found.youParticipantId);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(run.summarize(result));
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );

  test(
    'a GRID battle survives a dropped socket during rock-paper-scissors',
    () async {
      final player = await signInFreshLivePlayer('grid-reconnect');
      final run = LiveBattleRun(
        player,
        GameType.grid,
        dropSocketWhen: (battle) =>
            battle.phase == BattlePhase.pickingFirst &&
            battle.firstMoverDuel?.pickDeadlineAt != null &&
            !battle.firstMoverDuel!.hasPicked,
      );
      final found = await run.start();

      final result = await run.waitUntilFinished();

      expect(run.resyncAfterReconnect, isA<BattleCommandAccepted>());
      final restored = run.stateAfterReconnect!;
      expect(restored.phase, BattlePhase.pickingFirst);
      expect(restored.youParticipantId, found.youParticipantId);
      expect(restored.players, hasLength(found.players.length));
      expect(restored.firstMoverDuel, isNotNull);
      expect(restored.firstMoverDuel!.pickDeadlineAt, isNotNull);
      expect(restored.firstMoverDuel!.hasPicked, isFalse);
      expect(run.connectCount, 2);
      expectBattleCompletedWithPlacements(run, result);
      _expectOwnPickReachedTheServer(run, found.youParticipantId);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(run.summarize(result));
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );
}

/// The player's own throw was used (not one the server made up after the deadline), the duel
/// ended with a winner, and a tie, when one happened, was followed by a replay.
void _expectOwnPickReachedTheServer(
  LiveBattleRun run,
  String youParticipantId,
) {
  final results = run.rockPaperScissorsResults;
  expect(results, isNotEmpty);
  final firstPicks = results.first.picks;
  expect(
    firstPicks
        .singleWhere((pick) => pick.participantId == youParticipantId)
        .wasPickedByServer,
    isFalse,
  );
  expect(results.last.winnerId, isNotNull);
  for (final (index, result) in results.indexed) {
    expect(result.attempt, index + 1, reason: 'attempts follow each other');
  }
}
