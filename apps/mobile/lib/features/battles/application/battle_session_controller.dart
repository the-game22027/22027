import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/session/fresh_access_token.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/application/server_clock.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';
import 'package:the_game/features/battles/data/play_state_repository.dart';
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

  /// Set when a battle is resumed from play-state, to find the player's seat in it.
  String? _viewerUserId;

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

  /// Throws in the current rock-paper-scissors attempt. The server keeps it secret until
  /// both players have picked (`08` §9.1).
  Future<BattleCommandResult> pickRockPaperScissors(
    RockPaperScissorsChoice choice,
  ) async {
    final duel = state.battle?.firstMoverDuel;
    if (duel == null) return const BattleCommandRejected('INVALID_STATE');
    final result = await _sendBattleCommand('battle:rps-pick', {
      'attempt': duel.attempt,
      'choice': findRockPaperScissorsCode(choice),
    });
    final current = state.battle;
    final currentDuel = current?.firstMoverDuel;
    if (result is BattleCommandAccepted &&
        ref.mounted &&
        current != null &&
        currentDuel?.attempt == duel.attempt) {
      state = state.copyWith(
        battle: () => current.copyWith(
          firstMoverDuel: () => currentDuel!.copyWith(hasPicked: true),
        ),
      );
    }
    return result;
  }

  Future<BattleCommandResult> buzz() =>
      _sendRoundCommand('round:buzz', const {});

  /// Sends what the player typed. The server judges it, typos included (ADR-0021); a blank
  /// answer comes back as `EMPTY_ANSWER`, the verdict arrives as an event.
  Future<BattleCommandResult> answerWithText(String text) =>
      _sendRoundCommand('round:answer', {
        'answer': {'text': text},
      });

  Future<BattleCommandResult> answerWithNumber(num number) =>
      _sendRoundCommand('round:answer', {
        'answer': {'number': number},
      });

  Future<BattleCommandResult> claimGridCell(GridCell cell, String text) =>
      _sendRoundCommand('grid:claim', {
        'cell': {'row': cell.row, 'col': cell.col},
        'answer': {'text': text},
      });

  Future<BattleCommandResult> skipGridTurn() =>
      _sendRoundCommand('grid:skip', const {});

  /// `auction:pick`: the picker chooses list 0, 1 or 2 (`08` §11.1).
  Future<BattleCommandResult> pickAuctionList(int list) =>
      _sendRoundCommand('auction:pick', {'list': list});

  /// `auction:bid`: opens or raises. A bid of the whole list is the all-in; the server refuses
  /// `BID_TOO_LOW` and `BID_TOO_HIGH`.
  Future<BattleCommandResult> bidInAuction(int amount) =>
      _sendRoundCommand('auction:bid', {'amount': amount});

  /// `auction:call` ("اتفضل ورّيني"): the last bidder must now prove the bid.
  Future<BattleCommandResult> callAuctionBid() =>
      _sendRoundCommand('auction:call', const {});

  /// `auction:answer`: a name during your proof or your steal. The verdict arrives as
  /// `auction:answered`.
  Future<BattleCommandResult> answerInAuction(String text) =>
      _sendRoundCommand('auction:answer', {
        'answer': {'text': text},
      });

  /// `hex:pick`: the player on turn picks an open cell (`08` §13.1). With [clear], an opponent's cell
  /// goes back to open and is raced at once ("شيلها", once per battle).
  Future<BattleCommandResult> pickHexCell(int cell, {bool clear = false}) =>
      _sendRoundCommand('hex:pick', {'cell': cell, if (clear) 'clear': true});

  /// `hex:answer`: a name during the race. It must start with the cell's letter in your language;
  /// a right name with another first letter is refused `WRONG_LETTER` without a lockout.
  Future<BattleCommandResult> answerInHex(String text) =>
      _sendRoundCommand('hex:answer', {
        'answer': {'text': text},
      });

  /// `vault:try`: the whole code, one digit per question (`08` §12.1). A wrong try's ack tells only
  /// you, with when you may try again; the others see your try count only.
  Future<BattleCommandResult> tryVaultCode(String code) async {
    final result = await _sendRoundCommand('vault:try', {'code': code});
    final battle = state.battle;
    final round = battle?.currentRound;
    if (!ref.mounted || battle == null || round is! VaultRound) return result;
    if (result case BattleCommandAccepted(:final ack)) {
      if (ack['data'] case final Map<Object?, Object?> data) {
        final reader = JsonObjectReader(data, 'vault:try ack');
        state = state.copyWith(
          battle: () => battle.copyWith(
            currentRound: () => round.copyWith(
              yourLockedUntil: () =>
                  reader.readOptionalTimestamp('lockedUntil'),
              triesByParticipant: {
                ...round.triesByParticipant,
                battle.youParticipantId: reader.readInt('tries'),
              },
            ),
          ),
        );
      }
    }
    return result;
  }

  /// `mines:bury`: buries one mine in secret (`08` §10.1). The ack carries your mines so far,
  /// which only you ever see; a name outside the category uses one of your wrong tries.
  Future<BattleCommandResult> buryMine(String text) async {
    final result = await _sendRoundCommand('mines:bury', {
      'answer': {'text': text},
    });
    final battle = state.battle;
    final round = battle?.currentRound;
    if (!ref.mounted || battle == null || round is! MinesRound) return result;
    final MinesRound? updated = switch (result) {
      BattleCommandAccepted(:final ack) => switch (ack['data']) {
        final Map<Object?, Object?> data => () {
          final reader = JsonObjectReader(data, 'mines:bury ack');
          return round.copyWith(
            yourMines: readMines(reader.readObjectList('mines')),
            wrongTriesLeft: reader.readInt('wrongTriesLeft'),
          );
        }(),
        _ => null,
      },
      BattleCommandRejected(code: 'NOT_IN_CATEGORY')
          when round.wrongTriesLeft != null =>
        round.copyWith(wrongTriesLeft: round.wrongTriesLeft! - 1),
      _ => null,
    };
    if (updated != null) {
      state = state.copyWith(
        battle: () => battle.copyWith(currentRound: () => updated),
      );
    }
    return result;
  }

  /// `mines:answer`: your turn's name. The outcome arrives as `mines:answered`; your own live
  /// mine comes back as `OWN_MINE` and the turn goes on.
  Future<BattleCommandResult> answerMines(String text) =>
      _sendRoundCommand('mines:answer', {
        'answer': {'text': text},
      });

  /// `mines:scan`: asks the detector whether a name is the other player's mine. The answer
  /// arrives in your copy of `mines:scanned`.
  Future<BattleCommandResult> scanForMine(String text) =>
      _sendRoundCommand('mines:scan', {
        'answer': {'text': text},
      });

  /// Leaves the battle for good (last place, DEC-33).
  Future<BattleCommandResult> forfeitBattle() =>
      _sendBattleCommand('battle:forfeit');

  /// Asks for a snapshot and applies it. Called on a `seq` gap and after a reconnect. The
  /// server refuses with `NOT_PARTICIPANT` once the battle is no longer live (finished or
  /// abandoned while the player was away): the battle then ends here as
  /// [BattlePhase.endedWhileAway] instead of waiting for events that will never come.
  Future<BattleCommandResult> resynchronizeBattle() async {
    final battle = state.battle;
    if (battle == null) {
      return const BattleCommandRejected('NO_BATTLE');
    }
    final result = await _sendCommand('battle:resync', {
      'battleId': battle.battleId,
      'lastSeq': battle.lastSeq,
    });
    final current = state.battle;
    if (!ref.mounted ||
        current == null ||
        current.battleId != battle.battleId ||
        current.isFinished) {
      return result;
    }
    switch (result) {
      case BattleCommandAccepted(:final ack):
        state = state.copyWith(
          battle: () => applyBattleSnapshot(
            current,
            ack['snapshot'],
            viewerUserId: _viewerUserId,
          ),
        );
      case BattleCommandRejected(code: 'NOT_PARTICIPANT'):
        state = state.copyWith(
          battle: () => current.copyWith(
            phase: BattlePhase.endedWhileAway,
            currentRound: () => null,
            needsResync: false,
          ),
        );
      case BattleCommandRejected():
        break;
    }
    return result;
  }

  /// After the app starts or comes back: restores the queue ticket or the running battle the
  /// server says the player has (`GET /v1/me/play-state`). A battle is rebuilt from a
  /// snapshot now, or on the next connect when the socket is not up yet.
  Future<PlayState> resumePlayState() async {
    final repository = ref.read(playStateRepositoryProvider);
    final playState = await repository.fetchPlayState();
    if (!ref.mounted) return playState;

    final ticket = playState.queuedTicket;
    state = state.copyWith(
      queuedTicket: () => ticket == null
          ? null
          : MatchmakingQueued(
              serverTime: playState.serverTime,
              ticketId: ticket.ticketId,
              gameType: ticket.gameType,
              queuedAt: ticket.queuedAt,
              botFallbackAt: ticket.botFallbackAt,
            ),
    );

    final battleId = playState.battleId;
    if (battleId != null && state.battle?.battleId != battleId) {
      _viewerUserId = await repository.fetchSignedInUserId();
      if (!ref.mounted) return playState;
      state = state.copyWith(battle: () => createBattleStateToResume(battleId));
      await resynchronizeBattle();
    }
    return playState;
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
