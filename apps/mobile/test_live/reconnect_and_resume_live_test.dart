// Coming back to a running battle on the local backend: a dropped socket mid-round
// (battle:resync), and a second device that finds the battle through GET /v1/me/play-state.
// Run by hand, see test_live/README.md.
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
    'a BUZZER battle survives a dropped socket in round 2',
    () async {
      final player = await signInFreshLivePlayer('buzzer-reconnect');
      final run = LiveBattleRun(
        player,
        GameType.buzzer,
        dropSocketWhen: (battle) => (battle.currentRound?.roundNo ?? 0) >= 2,
        socketDownFor: const Duration(seconds: 2),
      );
      final found = await run.start();

      final result = await run.waitUntilFinished();

      expect(run.resyncAfterReconnect, isA<BattleCommandAccepted>());
      final restored = run.stateAfterReconnect!;
      expect(restored.phase, BattlePhase.inProgress);
      expect(restored.youParticipantId, found.youParticipantId);
      expect(restored.needsResync, isFalse);
      expect(run.connectCount, 2);
      expectBattleCompletedWithPlacements(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(run.summarize(result));
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );

  test(
    'a second device resumes the running battle from play-state, and its forfeit abandons it',
    () async {
      final player = await signInFreshLivePlayer('resume');
      final run = LiveBattleRun(player, GameType.buzzer);
      final found = await run.start();
      await waitForBattleSession(
        player,
        (session) => session.battle?.currentRound != null,
      );

      final secondDevice = await player.openSecondDevice();
      final secondController = secondDevice.read(
        battleSessionProvider.notifier,
      );
      final playState = await secondController.resumePlayState();
      expect(playState.battleId, found.battleId);
      expect(playState.battleStatus, 'IN_PROGRESS');

      // The second device takes over the battle (its resync makes it the active socket).
      run.stopMoving();
      secondController.connect();
      final resumed = (await waitForBattleSession(
        secondDevice,
        (session) =>
            session.connection == BattleSocketStatus.connected &&
            session.battle != null &&
            !session.battle!.needsResync &&
            session.battle!.players.isNotEmpty,
      )).battle!;
      expect(resumed.battleId, found.battleId);
      expect(resumed.gameType, GameType.buzzer);
      expect(resumed.youParticipantId, found.youParticipantId);
      expect(resumed.phase, BattlePhase.inProgress);

      expect(
        await secondController.forfeitBattle(),
        isA<BattleCommandAccepted>(),
      );
      final firstDeviceResult = await run.waitUntilFinished(
        timeout: const Duration(seconds: 30),
      );
      final secondDeviceBattle = (await waitForBattleSession(
        secondDevice,
        (session) => session.battle?.isFinished ?? false,
      )).battle!;

      // The only human left, and a bot never keeps a battle alive alone (WEBSOCKET.md §6.4).
      for (final battle in [firstDeviceResult.battle!, secondDeviceBattle]) {
        expect(battle.phase, BattlePhase.completed);
        expect(battle.completion!.endReason, 'ABANDONED');
        expect(battle.completion!.placements, isEmpty);
      }
      expect(player.unreadableEvents, isEmpty);
      expect(secondDevice.unreadableEvents, isEmpty);
      await expectPlayerToBeIdle(player);
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );
}
