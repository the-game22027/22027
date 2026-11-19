// VAULT (الخزنة, 08 §12) battles against the bot on the local backend: no first mover, both
// players race on the same 4-digit code, wrong tries lock only the sender out, digits leak over
// time. One run drops the socket after a wrong try and must come back through battle:resync.
// Without published VAULT rounds the server answers NO_CONTENT and both tests are reported as
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
    'a VAULT battle against the bot: wrong tries, a lockout, leaks, to the end',
    () async {
      final player = await signInFreshLivePlayer('vault');
      final run = LiveBattleRun(player, GameType.vault);
      if (!await _startUnlessNoVaultContent(run)) return;

      final result = await run.waitUntilFinished(
        timeout: const Duration(minutes: 11),
      );

      expectBattleCompletedWithPlacements(run, result);
      _expectVaultTriesAndReveals(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(_summarizeVault(run, result));
    },
    timeout: const Timeout(Duration(minutes: 12)),
  );

  test(
    'a VAULT battle survives a dropped socket after a wrong try',
    () async {
      final player = await signInFreshLivePlayer('vault-reconnect');
      final run = LiveBattleRun(
        player,
        GameType.vault,
        dropSocketWhen: (battle) => switch (battle.currentRound) {
          VaultRound(:final triesByParticipant) =>
            (triesByParticipant[battle.youParticipantId] ?? 0) > 0,
          _ => false,
        },
      );
      if (!await _startUnlessNoVaultContent(run)) return;

      final result = await run.waitUntilFinished(
        timeout: const Duration(minutes: 11),
      );

      expect(run.resyncAfterReconnect, isA<BattleCommandAccepted>());
      final restored = run.stateAfterReconnect!;
      expect(restored.phase, BattlePhase.inProgress);
      final restoredRound = restored.currentRound! as VaultRound;
      expect(restoredRound.questions, hasLength(restoredRound.digits));
      expect(
        restoredRound.triesByParticipant[restored.youParticipantId],
        greaterThan(0),
        reason: 'the snapshot keeps your wrong tries',
      );
      expect(run.connectCount, 2);
      expectBattleCompletedWithPlacements(run, result);
      _expectVaultTriesAndReveals(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(_summarizeVault(run, result));
    },
    timeout: const Timeout(Duration(minutes: 12)),
  );
}

/// False, with the test marked skipped, when the bank has no published VAULT rounds.
Future<bool> _startUnlessNoVaultContent(LiveBattleRun run) async {
  try {
    await run.start();
  } on TestFailure catch (failure) {
    if (!(failure.message?.contains('NO_CONTENT') ?? false)) rethrow;
    markTestSkipped('no VAULT content: the server answered NO_CONTENT');
    return false;
  }
  return true;
}

/// A wrong try was acked to this device only, the try sent while locked out was refused, and
/// each closed round revealed the code and every question's digit.
void _expectVaultTriesAndReveals(LiveBattleRun run, BattleSessionState result) {
  expect(run.vaultWrongTries, greaterThan(0), reason: 'no wrong try acked');
  expect(run.vaultRefusals, contains('LOCKED_OUT'));
  for (final round in result.battle!.finishedRounds) {
    final reveal = round.reveal;
    final code = reveal['code'];
    expect(code, isA<String>(), reason: 'round ${round.roundNo}');
    expect(
      ['OPENED', 'NOBODY'],
      contains(reveal['outcome']),
      reason: 'round ${round.roundNo}',
    );
    expect(
      reveal['answers'],
      hasLength((code! as String).length),
      reason: 'round ${round.roundNo}',
    );
  }
}

String _summarizeVault(LiveBattleRun run, BattleSessionState result) =>
    '${run.summarize(result)}, '
    'outcomes ${result.battle!.finishedRounds.map((round) => round.reveal['outcome']).join('/')}, '
    'wrong tries ${run.vaultWrongTries}, refusals ${run.vaultRefusals.join('/')}, '
    'leaks ${run.vaultLeaks}';
