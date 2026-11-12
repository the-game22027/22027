import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/session/fresh_access_token.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/application/server_clock.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';
import 'package:uuid/uuid.dart';

/// Everything about live play for the signed-in player: the socket, matchmaking, the
/// current battle and the server clock.
class BattleSessionState {
  const BattleSessionState({
    this.connection = BattleSocketStatus.disconnected,
    this.queuedTicket,
    this.battle,
    this.clock = ServerClock.unsynchronized,
    this.lastServerError,
  });

  final BattleSocketStatus connection;

  /// Set while waiting in the matchmaking queue.
  final MatchmakingQueued? queuedTicket;
  final BattleState? battle;
  final ServerClock clock;

  /// The last `error` event, for example `NO_CONTENT` (no battle could start).
  final BattleServerError? lastServerError;

  bool get isQueued => queuedTicket != null;

  BattleSessionState copyWith({
    BattleSocketStatus? connection,
    MatchmakingQueued? Function()? queuedTicket,
    BattleState? Function()? battle,
    ServerClock? clock,
    BattleServerError? Function()? lastServerError,
  }) => BattleSessionState(
    connection: connection ?? this.connection,
    queuedTicket: queuedTicket == null ? this.queuedTicket : queuedTicket(),
    battle: battle == null ? this.battle : battle(),
    clock: clock ?? this.clock,
    lastServerError: lastServerError == null
        ? this.lastServerError
        : lastServerError(),
  );
}

/// The device clock, replaceable in tests.
final deviceClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

/// The use cases of live play. Commands return the server's ack: the server decides
/// (a buzz can be `BUZZ_TAKEN`), and the result of an answer arrives as an event.
class BattleSessionController extends Notifier<BattleSessionState> {
  static const _clockSampleCount = 5;
  final _uuid = const Uuid();
  bool _hasRetriedRefusedHandshake = false;

  BattleSocketConnection get _connection =>
      ref.read(battleSocketConnectionProvider);

  @override
  BattleSessionState build() {
    final connection = ref.watch(battleSocketConnectionProvider);
    final eventSubscription = connection.events.listen(_handleServerEvent);
    final statusSubscription = connection.statuses.listen(_handleStatusChange);
    ref.onDispose(() {
      unawaited(eventSubscription.cancel());
      unawaited(statusSubscription.cancel());
    });
    return BattleSessionState(connection: connection.status);
  }

  void connect() {
    _hasRetriedRefusedHandshake = false;
    _connection.connect();
  }

  void disconnect() => _connection.disconnect();

  /// `matchmaking:join`. `PLAYER_BUSY`, `GAME_TYPE_UNAVAILABLE` and `RATE_LIMITED` come back
  /// as a rejection; `matchmaking:queued` then `battle:found` follow as events.
  Future<BattleCommandResult> joinMatchmaking(GameType gameType) =>
      _sendCommand('matchmaking:join', {
        'gameType': convertGameTypeToCode(gameType),
      });

  Future<BattleCommandResult> leaveMatchmaking() async {
    final result = await _sendCommand('matchmaking:leave', {});
    if (result is BattleCommandAccepted && ref.mounted) {
      state = state.copyWith(queuedTicket: () => null);
    }
    return result;
  }

  /// `battle:ready`: this device becomes the one that plays (the active socket).
  Future<BattleCommandResult> markReady() => _sendBattleCommand('battle:ready');

  Future<BattleCommandResult> buzz() =>
      _sendRoundCommand('round:buzz', const {});

  /// Answers with an entity picked from the catalog suggestions (never free text, DEC-55).
  Future<BattleCommandResult> answerWithEntity(String entityId) =>
      _sendRoundCommand('round:answer', {
        'answer': {'entityId': entityId},
      });

  Future<BattleCommandResult> answerWithNumber(num number) =>
      _sendRoundCommand('round:answer', {
        'answer': {'number': number},
      });

  Future<BattleCommandResult> claimGridCell(GridCell cell, String entityId) =>
      _sendRoundCommand('grid:claim', {
        'cell': {'row': cell.row, 'col': cell.col},
        'answer': {'entityId': entityId},
      });

  Future<BattleCommandResult> skipGridTurn() =>
      _sendRoundCommand('grid:skip', const {});

  /// Leaves the battle for good (last place, DEC-33).
  Future<BattleCommandResult> forfeitBattle() =>
      _sendBattleCommand('battle:forfeit');

  /// Asks for a snapshot and applies it. Called on a `seq` gap and after a reconnect.
  Future<BattleCommandResult> resynchronizeBattle() async {
    final battle = state.battle;
    if (battle == null) {
      return const BattleCommandRejected('NO_BATTLE');
    }
    final result = await _sendCommand('battle:resync', {
      'battleId': battle.battleId,
      'lastSeq': battle.lastSeq,
    });
    if (result is BattleCommandAccepted && ref.mounted) {
      final current = state.battle;
      if (current != null && current.battleId == battle.battleId) {
        state = state.copyWith(
          battle: () => applyBattleSnapshot(current, result.ack['snapshot']),
        );
      }
    }
    return result;
  }

  /// Forgets a finished battle once the screen is done with its result.
  void dismissFinishedBattle() {
    if (state.battle?.isFinished ?? false) {
      state = state.copyWith(battle: () => null);
    }
  }

  /// `time:sync` several times; the fastest round trip sets the clock (`WEBSOCKET.md` §5).
  Future<void> synchronizeServerClock() async {
    final readDeviceTime = ref.read(deviceClockProvider);
    final samples = <TimeSyncSample>[];
    for (var attempt = 0; attempt < _clockSampleCount; attempt++) {
      final sentAt = readDeviceTime();
      final result = await _connection.sendCommand('time:sync', {
        't0': sentAt.millisecondsSinceEpoch,
      });
      final receivedAt = readDeviceTime();
      if (result case BattleCommandAccepted(:final ack)) {
        final serverTime = DateTime.tryParse(
          ack['serverTime'] as String? ?? '',
        );
        if (serverTime != null) {
          samples.add(
            TimeSyncSample(
              sentAt: sentAt,
              receivedAt: receivedAt,
              serverTime: serverTime,
            ),
          );
        }
      }
    }
    if (samples.isNotEmpty && ref.mounted) {
      state = state.copyWith(
        clock: ServerClock(estimateServerClockOffset(samples)),
      );
    }
  }

  Future<BattleCommandResult> _sendRoundCommand(
    String event,
    Map<String, Object?> fields,
  ) {
    final round = state.battle?.currentRound;
    if (round == null) {
      return Future.value(const BattleCommandRejected('NO_ROUND'));
    }
    return _sendBattleCommand(event, {'roundNo': round.roundNo, ...fields});
  }

  Future<BattleCommandResult> _sendBattleCommand(
    String event, [
    Map<String, Object?> fields = const {},
  ]) {
    final battle = state.battle;
    if (battle == null) {
      return Future.value(const BattleCommandRejected('NO_BATTLE'));
    }
    return _sendCommand(event, {'battleId': battle.battleId, ...fields});
  }

  Future<BattleCommandResult> _sendCommand(
    String event,
    Map<String, Object?> fields,
  ) => _connection.sendCommand(event, {'clientMsgId': _uuid.v4(), ...fields});

  void _handleServerEvent(BattleServerEvent event) {
    switch (event) {
      case MatchmakingQueued():
        state = state.copyWith(
          queuedTicket: () => event,
          lastServerError: () => null,
        );
      case MatchmakingTimedOut():
        state = state.copyWith(queuedTicket: () => null);
      case BattleServerError():
        // NO_CONTENT and SERVER_ERROR release the queue on the server.
        state = state.copyWith(
          queuedTicket: () => null,
          lastServerError: () => event,
        );
      case BattleFound():
        state = state.copyWith(
          queuedTicket: () => null,
          battle: () => createBattleStateFromFound(event),
        );
      default:
        final battle = state.battle;
        if (battle == null) return;
        final next = applyBattleEvent(battle, event);
        if (identical(next, battle)) return;
        state = state.copyWith(battle: () => next);
        if (next.needsResync && !battle.needsResync) {
          unawaited(resynchronizeBattle());
        }
    }
  }

  Future<void> _handleStatusChange(BattleSocketStatus status) async {
    state = state.copyWith(connection: status);
    switch (status) {
      case BattleSocketStatus.connected:
        _hasRetriedRefusedHandshake = false;
        await synchronizeServerClock();
        final battle = state.battle;
        if (battle != null && !battle.isFinished) {
          await resynchronizeBattle();
        }
      case BattleSocketStatus.refused:
        // Usually an expired access token: refresh it the app's one way, then try once more.
        if (_hasRetriedRefusedHandshake) return;
        _hasRetriedRefusedHandshake = true;
        final token = await obtainFreshAccessToken(ref);
        if (token != null && ref.mounted) _connection.connect();
      case BattleSocketStatus.disconnected:
      case BattleSocketStatus.connecting:
        break;
    }
  }
}

final battleSessionProvider =
    NotifierProvider<BattleSessionController, BattleSessionState>(
      BattleSessionController.new,
    );
