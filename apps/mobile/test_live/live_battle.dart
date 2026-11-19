/// Plays one battle against the bot the way a screen would: it reacts to the battle state the
/// server builds and never knows an answer. The server judges every move, decides turns and
/// ends timers; this only sends what a player could send at that moment.
library;

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/battle_session_controller.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';
import 'package:the_game/features/battles/data/play_state_repository.dart';

import 'live_backend.dart';

/// A guess that is probably wrong, so wrong answers and misses are exercised too.
const _guess = 'Messi';

/// Names typed for MINES with no idea of the category, so most are refused as
/// `NOT_IN_CATEGORY` and the server buries the rest at the deadline.
const _mineGuesses = [
  'Messi',
  'Zidane',
  'Pele',
  'Maradona',
  'Ronaldo',
  'Henry',
];

/// Rock, then paper, then scissors on replays, so a tie with the bot can happen.
const _rockPaperScissorsCycle = [
  RockPaperScissorsChoice.rock,
  RockPaperScissorsChoice.paper,
  RockPaperScissorsChoice.scissors,
];

class LiveBattleRun {
  LiveBattleRun(
    this.player,
    this.gameType, {
    this.dropSocketWhen,
    this.socketDownFor = const Duration(seconds: 1),
  });

  final LivePlayer player;
  final GameType gameType;

  /// The first time it holds, the socket drops for [socketDownFor] and connects again.
  final bool Function(BattleState battle)? dropSocketWhen;
  final Duration socketDownFor;

  /// Events, moves and phase changes in order; printed when the test fails.
  final log = <String>[];

  /// `seq` gaps seen before any socket drop. A normal run has none.
  final seqGaps = <String>[];
  final rockPaperScissorsResults = <RockPaperScissorsResult>[];

  /// MINES: your mines when the turns began (the server buried any missing ones), and the
  /// detector's private answer.
  int? minesAtFirstTurn;
  MineScanResult? scanResult;

  /// The `battle:resync` ack after the socket came back, and the state it left.
  BattleCommandResult? resyncAfterReconnect;
  BattleState? stateAfterReconnect;
  int connectCount = 0;

  final _finished = Completer<BattleSessionState>();
  final _pickedAttempts = <int>{};
  final _buzzedRounds = <int>{};
  final _playedGridTurns = <DateTime>{};
  final _playedMinesTurns = <int>{};
  bool _hasStartedBurying = false;
  bool _isMoving = true;
  bool _hasDroppedSocket = false;
  bool _isSocketDropped = false;
  String? _battleId;
  int _lastSeenSeq = 0;

  BattleSessionController get controller =>
      player.read(battleSessionProvider.notifier);
  BattleSessionState get session => player.read(battleSessionProvider);
  bool get hasDroppedSocket => _hasDroppedSocket;

  /// Connects, joins matchmaking, waits for the bot and marks ready. Returns the new battle.
  Future<BattleState> start() async {
    addTearDown(() => printOnFailure(log.join('\n')));
    addTearDown(_forfeitIfStillRunning);
    final eventSubscription = player
        .read(battleSocketConnectionProvider)
        .events
        .listen(_recordEvent);
    addTearDown(eventSubscription.cancel);
    final sessionSubscription = player.container.listen(
      battleSessionProvider,
      _reactToSession,
    );
    addTearDown(sessionSubscription.close);

    controller.connect();
    await waitForBattleSession(
      player,
      (session) => session.connection == BattleSocketStatus.connected,
    );
    final join = await controller.joinMatchmaking(gameType);
    log.add('join: ${describeCommandResult(join)}');
    if (join is BattleCommandRejected) {
      fail('matchmaking:join was refused: ${join.code}');
    }
    final found = await waitForBattleSession(
      player,
      (session) => session.battle != null || session.lastServerError != null,
    );
    final error = found.lastServerError;
    if (error != null) fail('server error ${error.code}: ${error.message}');
    log.add('ready: ${describeCommandResult(await controller.markReady())}');
    return found.battle!;
  }

  Future<BattleSessionState> waitUntilFinished({
    Duration timeout = const Duration(minutes: 5),
  }) => _finished.future.timeout(
    timeout,
    onTimeout: () => fail(
      'no end after ${timeout.inMinutes} minutes; '
      'phase ${session.battle?.phase}',
    ),
  );

  /// From now on this device only watches, for example after another device took over.
  void stopMoving() => _isMoving = false;

  /// One line for the test output: how the battle went.
  String summarize(BattleSessionState result) {
    final battle = result.battle;
    return '${convertGameTypeToCode(gameType)}: '
        'end ${battle?.completion?.endReason}, '
        'you ${battle?.completion?.yourOutcome?.name}, '
        'rounds ${battle?.finishedRounds.length}, '
        'rock-paper-scissors attempts ${rockPaperScissorsResults.length}, '
        'clock offset ${result.clock.offset.inMilliseconds} ms, '
        'connects $connectCount';
  }

  void _reactToSession(BattleSessionState? previous, BattleSessionState next) {
    if (next.connection != previous?.connection) {
      log.add('socket ${next.connection.name}');
      if (next.connection == BattleSocketStatus.connected) connectCount++;
    }
    final battle = next.battle;
    if (battle?.phase != previous?.battle?.phase) {
      log.add('phase ${battle?.phase.name}');
    }
    if (next.lastServerError != null && !_finished.isCompleted) {
      _finished.complete(next);
    }
    if (battle == null) return;
    if (battle.isFinished && !_finished.isCompleted) _finished.complete(next);
    if (battle.needsResync &&
        !(previous?.battle?.needsResync ?? false) &&
        !_hasDroppedSocket) {
      seqGaps.add('the reducer asked for a resync after seq ${battle.lastSeq}');
    }
    if (!_isMoving ||
        _isSocketDropped ||
        next.connection != BattleSocketStatus.connected) {
      return;
    }

    final dropSocketWhen = this.dropSocketWhen;
    if (dropSocketWhen != null &&
        !_hasDroppedSocket &&
        !battle.isFinished &&
        dropSocketWhen(battle)) {
      _hasDroppedSocket = true;
      unawaited(_dropSocketAndReconnect());
      return;
    }
    unawaited(_makeMove(battle));
  }

  Future<void> _dropSocketAndReconnect() async {
    _isSocketDropped = true;
    log.add('dropping the socket for ${socketDownFor.inMilliseconds} ms');
    controller.disconnect();
    await Future<void>.delayed(socketDownFor);
    controller.connect();
    await waitForBattleSession(
      player,
      (session) => session.connection == BattleSocketStatus.connected,
    );
    // The controller resyncs on connect by itself; this second one shows what it gets back.
    final resync = await controller.resynchronizeBattle();
    resyncAfterReconnect = resync;
    stateAfterReconnect = session.battle;
    log.add(
      'resync after reconnect: ${describeCommandResult(resync)}, '
      'phase ${stateAfterReconnect?.phase.name}, '
      'lastSeq ${stateAfterReconnect?.lastSeq}',
    );
    _isSocketDropped = false;
    final battle = session.battle;
    if (battle != null && !battle.isFinished) await _makeMove(battle);
  }

  Future<void> _makeMove(BattleState battle) async {
    switch (battle.phase) {
      case BattlePhase.pickingFirst:
        await _pickRockPaperScissorsIfAsked(battle);
      case BattlePhase.inProgress:
        switch (battle.currentRound) {
          case final RevealRound round:
            await _buzzAndAnswerIfAllowed(battle, round);
          case final GridRound round:
            await _claimOrSkipIfYourTurn(battle, round);
          case final MinesRound round:
            await _buryOrAnswerMines(battle, round);
          case null:
            break;
        }
      case BattlePhase.waitingReady:
      case BattlePhase.cancelled:
      case BattlePhase.completed:
      case BattlePhase.endedWhileAway:
        break;
    }
  }

  Future<void> _pickRockPaperScissorsIfAsked(BattleState battle) async {
    final duel = battle.firstMoverDuel;
    if (duel == null ||
        duel.pickDeadlineAt == null ||
        duel.hasPicked ||
        !_pickedAttempts.add(duel.attempt)) {
      return;
    }
    final choice =
        _rockPaperScissorsCycle[(duel.attempt - 1) %
            _rockPaperScissorsCycle.length];
    final pick = await controller.pickRockPaperScissors(choice);
    log.add(
      'rps pick ${choice.name} attempt ${duel.attempt}: '
      '${describeCommandResult(pick)}',
    );
  }

  Future<void> _buzzAndAnswerIfAllowed(
    BattleState battle,
    RevealRound round,
  ) async {
    if (round.revealedClues.length < 2 ||
        round.buzzHolderParticipantId != null ||
        round.lockedOutParticipantIds.contains(battle.youParticipantId) ||
        !_buzzedRounds.add(round.roundNo)) {
      return;
    }
    final buzz = await controller.buzz();
    log.add('buzz round ${round.roundNo}: ${describeCommandResult(buzz)}');
    if (buzz is! BattleCommandAccepted) return;
    final answer = (round.answerKind?.expectsNumber ?? false)
        ? await controller.answerWithNumber(0)
        : await controller.answerWithText(_guess);
    log.add('answer round ${round.roundNo}: ${describeCommandResult(answer)}');
  }

  /// Claims a free cell on every other turn and skips on the rest, so both commands run.
  Future<void> _claimOrSkipIfYourTurn(
    BattleState battle,
    GridRound round,
  ) async {
    final turnDeadlineAt = round.turnDeadlineAt;
    if (round.turnParticipantId != battle.youParticipantId ||
        turnDeadlineAt == null ||
        !_playedGridTurns.add(turnDeadlineAt)) {
      return;
    }
    final freeCell = _findFirstFreeCell(round);
    if (freeCell != null && _playedGridTurns.length.isOdd) {
      final claim = await controller.claimGridCell(freeCell, _guess);
      log.add(
        'claim (${freeCell.row},${freeCell.col}) round ${round.roundNo}: '
        '${describeCommandResult(claim)}',
      );
      if (claim is BattleCommandAccepted) return;
    }
    final skip = await controller.skipGridTurn();
    log.add('skip round ${round.roundNo}: ${describeCommandResult(skip)}');
  }

  Future<void> _buryOrAnswerMines(BattleState battle, MinesRound round) async {
    switch (round.phase) {
      case MinesPhase.burying:
        if (_hasStartedBurying) return;
        _hasStartedBurying = true;
        await _buryMinesFromGuesses(battle);
      case MinesPhase.turns:
        minesAtFirstTurn ??= round.yourMines.length;
        if (round.turnParticipantId != battle.youParticipantId ||
            !_playedMinesTurns.add(round.turnNo)) {
          return;
        }
        if (scanResult == null && (round.detectorUsesLeft ?? 1) > 0) {
          await _scanOnce(round);
        }
        final answer = await controller.answerMines(_guess);
        log.add(
          'mines answer turn ${round.turnNo}: ${describeCommandResult(answer)}',
        );
      case MinesPhase.closed:
        break;
    }
  }

  /// Stops at the config's number of mines, or when the server refuses another try.
  Future<void> _buryMinesFromGuesses(BattleState battle) async {
    final burying = battle.publicConfig['burying']! as Map<String, Object?>;
    final minesPerPlayer = burying['minesPerPlayer']! as int;
    for (final guess in _mineGuesses) {
      final round = session.battle?.currentRound;
      if (round is! MinesRound ||
          round.phase != MinesPhase.burying ||
          round.yourMines.length >= minesPerPlayer) {
        return;
      }
      final bury = await controller.buryMine(guess);
      log.add('bury $guess: ${describeCommandResult(bury)}');
      if (bury case BattleCommandRejected(
        code: 'NO_TRIES_LEFT' || 'ALL_MINES_BURIED' || 'BURY_WINDOW_CLOSED',
      )) {
        return;
      }
    }
  }

  /// Uses the detector, then waits for its private answer to reach the state.
  Future<void> _scanOnce(MinesRound round) async {
    final scan = await controller.scanForMine(_guess);
    log.add('mines scan turn ${round.turnNo}: ${describeCommandResult(scan)}');
    if (scan is! BattleCommandAccepted) return;
    final scanned = await waitForBattleSession(player, (session) {
      final current = session.battle?.currentRound;
      return current is! MinesRound || current.lastScanResult != null;
    }, timeout: const Duration(seconds: 5));
    final current = scanned.battle?.currentRound;
    if (current is MinesRound) scanResult = current.lastScanResult;
    log.add('mines scan result: ${scanResult?.name}');
  }

  void _recordEvent(BattleServerEvent event) {
    log.add(describeBattleEvent(event));
    if (event is BattleFound) {
      _battleId = event.battleId;
      _lastSeenSeq = event.seq!;
      return;
    }
    if (event is RockPaperScissorsResult) rockPaperScissorsResults.add(event);
    final seq = event.seq;
    if (seq == null || event.battleId != _battleId) return;
    if (seq > _lastSeenSeq + 1 && !_hasDroppedSocket) {
      seqGaps.add(
        'seq $_lastSeenSeq was followed by $seq (${event.runtimeType})',
      );
    }
    if (seq > _lastSeenSeq) _lastSeenSeq = seq;
  }

  /// A failed test must not leave a running battle behind for the next run.
  Future<void> _forfeitIfStillRunning() async {
    final battle = session.battle;
    if (battle == null || battle.isFinished) return;
    if (session.connection != BattleSocketStatus.connected) return;
    log.add(
      'teardown forfeit: ${describeCommandResult(await controller.forfeitBattle())}',
    );
  }
}

/// Waits until the player's battle session satisfies [isReached].
Future<BattleSessionState> waitForBattleSession(
  LivePlayer player,
  bool Function(BattleSessionState session) isReached, {
  Duration timeout = const Duration(seconds: 30),
}) {
  final current = player.read(battleSessionProvider);
  if (isReached(current)) return Future.value(current);
  final reached = Completer<BattleSessionState>();
  final subscription = player.container.listen(battleSessionProvider, (
    _,
    session,
  ) {
    if (isReached(session) && !reached.isCompleted) reached.complete(session);
  });
  return reached.future
      .timeout(
        timeout,
        onTimeout: () => fail(
          'the battle session did not reach the expected state in '
          '${timeout.inSeconds} s',
        ),
      )
      .whenComplete(subscription.close);
}

/// A finished battle leaves no queue ticket and no battle on the server. The battle row is
/// closed right after `battle:completed`, so this polls for a few seconds.
Future<void> expectPlayerToBeIdle(LivePlayer player) async {
  final repository = player.read(playStateRepositoryProvider);
  late PlayState playState;
  for (var attempt = 0; attempt < 10; attempt++) {
    playState = await repository.fetchPlayState();
    if (playState.isIdle) return;
    await Future<void>.delayed(const Duration(milliseconds: 500));
  }
  fail(
    'play-state is not idle: battle ${playState.battleId} '
    '(${playState.battleStatus}), ticket ${playState.queuedTicket?.ticketId}',
  );
}

/// Checks shared by every run that should end normally.
void expectBattleCompletedWithPlacements(
  LiveBattleRun run,
  BattleSessionState result,
) {
  final error = result.lastServerError;
  expect(
    error,
    isNull,
    reason: 'server error ${error?.code}: ${error?.message}',
  );
  expect(
    run.player.unreadableEvents,
    isEmpty,
    reason: 'events the app could not read',
  );
  final battle = result.battle!;
  expect(battle.gameType, run.gameType);
  expect(battle.phase, BattlePhase.completed);
  expect(battle.needsResync, isFalse);
  expect(battle.completion!.endReason, 'COMPLETED');
  expect(battle.completion!.placements, hasLength(battle.players.length));
  expect(battle.completion!.yourPoints, isNotNull);
  for (final round in battle.finishedRounds) {
    expect(round.questionId, isNotEmpty, reason: 'round ${round.roundNo}');
  }
  if (!run.hasDroppedSocket) {
    expect(run.seqGaps, isEmpty, reason: 'seq gaps in a normal run');
    expect(
      battle.finishedRounds,
      hasLength(battle.publicConfig['roundCount']),
      reason: 'every round of the config was played',
    );
  }
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

String describeCommandResult(BattleCommandResult result) => switch (result) {
  BattleCommandAccepted() => 'accepted',
  BattleCommandRejected(:final code) => 'rejected $code',
};

String describeBattleEvent(BattleServerEvent event) {
  final details = switch (event) {
    BattleServerError(:final code) => code,
    RockPaperScissorsStarted(:final attempt) => 'attempt $attempt',
    RockPaperScissorsResult(:final attempt, :final picks, :final winnerId) =>
      'attempt $attempt ${picks.map((pick) => '${pick.choice.name}${pick.wasPickedByServer ? ' (auto)' : ''}').join(' vs ')}'
          '${winnerId == null ? ', tie' : ''}',
    RevealRoundStarted(:final roundNo, :final answerKind) =>
      'round $roundNo ${answerKind.code}',
    GridRoundStarted(:final roundNo) => 'round $roundNo',
    MinesTurnStarted(:final participantId, :final turnNo) =>
      'turn $turnNo $participantId',
    MinesAnswered(:final outcome) => outcome.name,
    GridCellClaimed(:final cell, :final player) =>
      '(${cell.row},${cell.col}) ${player.name}',
    GridTurnMissed(:final hasTimedOut, :final wasSkipped) =>
      hasTimedOut ? 'timeout' : (wasSkipped ? 'skipped' : 'wrong'),
    WrongAnswerGiven(:final hasTimedOut) => hasTimedOut ? 'timeout' : 'wrong',
    BattleCompleted(:final endReason) => endReason,
    _ => '',
  };
  return '${event.seq ?? '-'} ${event.runtimeType} $details';
}
