import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/battles/data/battle_events.dart';

enum BattleSocketStatus {
  disconnected,
  connecting,
  connected,

  /// The handshake was refused (`UNAUTHENTICATED`): the token must be refreshed first.
  refused,
}

/// The acknowledgement of a command (`WEBSOCKET.md` §2), or a failure to get one.
sealed class BattleCommandResult {
  const BattleCommandResult();
}

class BattleCommandAccepted extends BattleCommandResult {
  const BattleCommandAccepted(this.ack);

  /// The whole ack, for commands that return data (`time:sync`, `battle:resync`).
  final Map<String, Object?> ack;
}

class BattleCommandRejected extends BattleCommandResult {
  const BattleCommandRejected(this.code);

  /// The server's code (`BUZZ_TAKEN`, `PLAYER_BUSY`, …), or [notConnected] / [noAck] when the
  /// command did not get an answer.
  final String code;

  static const notConnected = 'NOT_CONNECTED';
  static const noAck = 'NO_ACK';
}

/// The `/battles` namespace as a transport: connect, receive parsed events, send commands
/// with an ack. An interface so the session logic is tested without a server.
abstract interface class BattleSocketConnection {
  Stream<BattleServerEvent> get events;
  Stream<BattleSocketStatus> get statuses;
  BattleSocketStatus get status;

  /// Connects with the current access token, read again on every reconnect attempt.
  void connect();
  void disconnect();

  /// Sends [payload] and waits for the ack. A command is never queued while disconnected:
  /// a buzz sent late is worse than no buzz.
  Future<BattleCommandResult> sendCommand(
    String event,
    Map<String, Object?> payload,
  );

  void dispose();
}

/// Called with an event the app could not read: the server broke the contract, or the app
/// reads it wrong.
typedef UnreadableEventHandler =
    void Function(String eventName, Object? payload, FormatException error);

void _logUnreadableEvent(
  String eventName,
  Object? payload,
  FormatException error,
) => developer.log('ignored $eventName: $error', name: 'battles');

class SocketIoBattleConnection implements BattleSocketConnection {
  SocketIoBattleConnection({
    required String apiBaseUrl,
    required String? Function() readAccessToken,
    this.ackTimeout = const Duration(seconds: 10),
    this.onUnreadableEvent = _logUnreadableEvent,
  }) : _socket = socket_io.io(
         '$apiBaseUrl/battles',
         socket_io.OptionBuilder()
             .setTransports(['websocket'])
             .disableAutoConnect()
             .enableReconnection()
             // The token goes in the handshake auth, never in the URL (WEBSOCKET.md §1).
             .setAuthFn(
               (sendAuth) => sendAuth({'token': readAccessToken() ?? ''}),
             )
             .build(),
       ) {
    _socket
      ..onConnect((_) => _changeStatus(BattleSocketStatus.connected))
      ..onDisconnect((_) => _changeStatus(BattleSocketStatus.disconnected))
      ..onConnectError(_handleConnectError)
      ..onAny(_handleServerEvent);
  }

  final socket_io.Socket _socket;
  final Duration ackTimeout;
  final UnreadableEventHandler onUnreadableEvent;
  final _events = StreamController<BattleServerEvent>.broadcast();
  final _statuses = StreamController<BattleSocketStatus>.broadcast();
  BattleSocketStatus _status = BattleSocketStatus.disconnected;

  @override
  Stream<BattleServerEvent> get events => _events.stream;

  @override
  Stream<BattleSocketStatus> get statuses => _statuses.stream;

  @override
  BattleSocketStatus get status => _status;

  @override
  void connect() {
    _changeStatus(BattleSocketStatus.connecting);
    _socket.connect();
  }

  @override
  void disconnect() {
    _socket.disconnect();
    _changeStatus(BattleSocketStatus.disconnected);
  }

  @override
  Future<BattleCommandResult> sendCommand(
    String event,
    Map<String, Object?> payload,
  ) async {
    if (!_socket.connected) {
      return const BattleCommandRejected(BattleCommandRejected.notConnected);
    }
    final Object? ack;
    try {
      ack = await _socket.emitWithAckAsync(event, payload).timeout(ackTimeout);
    } on TimeoutException {
      return const BattleCommandRejected(BattleCommandRejected.noAck);
    }
    if (ack is! Map) {
      return const BattleCommandRejected(BattleCommandRejected.noAck);
    }
    final ackJson = ack.cast<String, Object?>();
    // time:sync acks carry no `accepted`; every other command does.
    if (ackJson['accepted'] == false) {
      return BattleCommandRejected(ackJson['code'] as String? ?? 'UNKNOWN');
    }
    return BattleCommandAccepted(ackJson);
  }

  @override
  void dispose() {
    _socket.dispose();
    unawaited(_events.close());
    unawaited(_statuses.close());
  }

  void _handleServerEvent(String eventName, Object? payload) {
    try {
      _events.add(parseBattleServerEvent(eventName, payload));
    } on FormatException catch (error) {
      // A contract break must not end the battle: skip the event; a seq gap then resyncs.
      onUnreadableEvent(eventName, payload, error);
    }
  }

  void _handleConnectError(Object? error) {
    final isUnauthenticated =
        error is Map &&
        (error['message'] == 'UNAUTHENTICATED' ||
            (error['data'] is Map &&
                (error['data'] as Map)['code'] == 'UNAUTHENTICATED'));
    _changeStatus(
      isUnauthenticated
          ? BattleSocketStatus.refused
          : BattleSocketStatus.disconnected,
    );
  }

  void _changeStatus(BattleSocketStatus status) {
    if (_status == status || _statuses.isClosed) return;
    _status = status;
    _statuses.add(status);
  }
}

final battleSocketConnectionProvider = Provider<BattleSocketConnection>((ref) {
  final connection = SocketIoBattleConnection(
    apiBaseUrl: ref.watch(appConfigProvider).apiBaseUrl,
    readAccessToken: () =>
        ref.read(sessionControllerProvider).value?.accessToken,
  );
  ref.onDispose(connection.dispose);
  return connection;
});
