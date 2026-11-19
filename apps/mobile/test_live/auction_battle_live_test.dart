// AUCTION (المزاد, 08 §11) battles against the bot on the local backend: rock-paper-scissors,
// then rounds of pick a list, bid or call, prove, steal, first to the config's target score.
// One run drops the socket during bidding and must come back through battle:resync. Without
// published AUCTION rounds the server answers NO_CONTENT and both tests are reported as
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
    'an AUCTION battle against the bot: picks, bids, an all-in, proofs to the end',
    () async {
      final player = await signInFreshLivePlayer('auction');
      final run = LiveBattleRun(player, GameType.auction);
      if (!await _startUnlessNoAuctionContent(run)) return;

      final result = await run.waitUntilFinished(
        timeout: const Duration(minutes: 8),
      );

      expectBattleCompletedWithPlacements(run, result);
      _expectAuctionRoundsRevealed(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(_summarizeAuction(run, result));
    },
    timeout: const Timeout(Duration(minutes: 9)),
  );

  test(
    'an AUCTION battle survives a dropped socket during bidding',
    () async {
      final player = await signInFreshLivePlayer('auction-reconnect');
      final run = LiveBattleRun(
        player,
        GameType.auction,
        dropSocketWhen: (battle) => switch (battle.currentRound) {
          AuctionRound(phase: AuctionPhase.bidding) => true,
          _ => false,
        },
      );
      if (!await _startUnlessNoAuctionContent(run)) return;

      final result = await run.waitUntilFinished(
        timeout: const Duration(minutes: 8),
      );

      expect(run.resyncAfterReconnect, isA<BattleCommandAccepted>());
      final restored = run.stateAfterReconnect!;
      expect(restored.phase, BattlePhase.inProgress);
      final restoredRound = restored.currentRound! as AuctionRound;
      expect(restoredRound.lists, hasLength(3));
      expect(restoredRound.phase, isNot(AuctionPhase.picking));
      expect(restoredRound.pickedList, isNotNull);
      expect(restoredRound.deadline, isNotNull);
      expect(run.connectCount, 2);
      expectBattleCompletedWithPlacements(run, result);
      _expectAuctionRoundsRevealed(run, result);
      await expectPlayerToBeIdle(player);
      // ignore: avoid_print
      print(_summarizeAuction(run, result));
    },
    timeout: const Timeout(Duration(minutes: 9)),
  );
}

/// False, with the test marked skipped, when the bank has no published AUCTION rounds.
Future<bool> _startUnlessNoAuctionContent(LiveBattleRun run) async {
  try {
    await run.start();
  } on TestFailure catch (failure) {
    if (!(failure.message?.contains('NO_CONTENT') ?? false)) rethrow;
    markTestSkipped('no AUCTION content: the server answered NO_CONTENT');
    return false;
  }
  return true;
}

/// Every proof had a known reason, this device's all-in reached the server, and each closed
/// round revealed the list, the outcome and the names.
void _expectAuctionRoundsRevealed(
  LiveBattleRun run,
  BattleSessionState result,
) {
  expect(run.auctionProofReasons, isNotEmpty, reason: 'no proof started');
  expect(run.auctionProofReasons, isNot(contains(AuctionProofReason.unknown)));
  for (final round in result.battle!.finishedRounds) {
    final reveal = round.reveal;
    expect(reveal['list'], isA<int>(), reason: 'round ${round.roundNo}');
    expect(
      ['PROVED', 'STOLEN', 'BUST', 'FORFEIT'],
      contains(reveal['outcome']),
      reason: 'round ${round.roundNo}',
    );
    expect(reveal['answers'], isNotEmpty, reason: 'round ${round.roundNo}');
  }
}

String _summarizeAuction(LiveBattleRun run, BattleSessionState result) =>
    '${run.summarize(result)}, '
    'proofs ${run.auctionProofReasons.map((reason) => reason.name).join('/')}, '
    'outcomes ${result.battle!.finishedRounds.map((round) => round.reveal['outcome']).join('/')}, '
    'names typed: proof ${run.auctionProofAnswers}, steal ${run.auctionStealAnswers}';
