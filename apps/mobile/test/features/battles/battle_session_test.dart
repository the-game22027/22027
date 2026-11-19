import 'dart:async';

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/battle_session_controller.dart';
import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/battle_socket_connection.dart';
import 'package:the_game/features/battles/data/play_state_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';
import 'battle_fixtures.dart';

class FakeBattleSocketConnection implements BattleSocketConnection {
  final _events = StreamController<BattleServerEvent>.broadcast();
  final _statuses = StreamController<BattleSocketStatus>.broadcast();
  final List<(String, Map<String, Object?>)> sentCommands = [];
  int connectCount = 0;

  /// Accepts every command; tests replace it to answer differently.
  BattleCommandResult Function(String event, Map<String, Object?> payload)
  answerCommand = (_, payload) =>
      BattleCommandAccepted({...payload, 'accepted': true});

  @override
  BattleSocketStatus status = BattleSocketStatus.disconnected;

  @override
  Stream<BattleServerEvent> get events => _events.stream;

  @override
  Stream<BattleSocketStatus> get statuses => _statuses.stream;

  @override
  void connect() => connectCount++;

  @override
  void disconnect() => changeStatus(BattleSocketStatus.disconnected);

  @override
  Future<BattleCommandResult> sendCommand(
    String event,
    Map<String, Object?> payload,
  ) async {
    sentCommands.add((event, payload));
    return answerCommand(event, payload);
  }

  @override
  void dispose() {}

  void changeStatus(BattleSocketStatus newStatus) {
    status = newStatus;
    _statuses.add(newStatus);
  }

  void receive(String type, Object? payload) =>
      _events.add(parseBattleServerEvent(type, payload));

  List<String> get sentEventNames => [
    for (final (name, _) in sentCommands) name,
  ];
}

void main() {
  late FakeBattleSocketConnection socket;
  late FakeHttpAdapter adapter;
  final deviceNow = DateTime.utc(2026, 11, 12, 10);

  setUp(() {
    socket = FakeBattleSocketConnection();
    adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
  });

  Future<ProviderContainer> createContainer() async {
    final container = await createSignedInTestContainer(
      adapter,
      extraOverrides: [
        battleSocketConnectionProvider.overrideWithValue(socket),
        deviceClockProvider.overrideWithValue(() => deviceNow),
      ],
    );
    container.listen(battleSessionProvider, (_, _) {});
    return container;
  }

  BattleSessionController controllerOf(ProviderContainer container) =>
      container.read(battleSessionProvider.notifier);

  Map<String, Object?> foundData() => {
    'gameType': 'BUZZER',
    'mode': 'MATCHMAKING',
    'players': [humanPlayerJson, botPlayerJson],
    'youParticipantId': 'p-human',
    'config': {'roundCount': 2},
    'readyDeadlineAt': '2026-11-12T10:00:10.000Z',
  };

  Future<void> receiveBattleFound(ProviderContainer container) async {
    socket.receive(
      'battle:found',
      battleEnvelope('battle:found', 1, foundData()),
    );
    await pumpEventQueue();
  }

  test('matchmaking: join, queued, then found', () async {
    final container = await createContainer();

    await controllerOf(container).joinMatchmaking(GameType.buzzer);
    socket.receive('matchmaking:queued', {
      'type': 'matchmaking:queued',
      'serverTime': serverTime,
      'data': {'ticketId': 't-1', 'gameType': 'BUZZER', 'queuedAt': serverTime},
    });
    await pumpEventQueue();
    expect(container.read(battleSessionProvider).isQueued, isTrue);

    await receiveBattleFound(container);

    final (event, payload) = socket.sentCommands.single;
    expect(event, 'matchmaking:join');
    expect(payload['gameType'], 'BUZZER');
    expect(payload['clientMsgId'], isA<String>());
    final session = container.read(battleSessionProvider);
    expect(session.isQueued, isFalse);
    expect(session.battle?.phase, BattlePhase.waitingReady);
  });

  test('battle commands carry the battle id and the current round', () async {
    final container = await createContainer();
    final controller = controllerOf(container);

    expect(
      await controller.buzz(),
      isA<BattleCommandRejected>().having((r) => r.code, 'code', 'NO_ROUND'),
    );

    await receiveBattleFound(container);
    await controller.markReady();
    socket.receive(
      'round:start',
      battleEnvelope('round:start', 2, {
        'roundNo': 3,
        'gameType': 'BUZZER',
        'answerKind': 'PLAYER',
        'stepCount': 4,
      }),
    );
    await pumpEventQueue();
    await controller.buzz();
    await controller.answerWithText('رونالدوو');

    expect(socket.sentEventNames, [
      'battle:ready',
      'round:buzz',
      'round:answer',
    ]);
    final (_, answer) = socket.sentCommands.last;
    expect(answer['battleId'], battleId);
    expect(answer['roundNo'], 3);
    expect(answer['answer'], {'text': 'رونالدوو'});
  });

  test('a grid claim sends the cell and the typed text', () async {
    final container = await createContainer();
    final controller = controllerOf(container);
    Map<String, Object?> criterion(String kind) => {
      'kind': kind,
      'entity': {'entityId': kind, 'name': kind},
    };

    await receiveBattleFound(container);
    socket.receive(
      'round:start',
      battleEnvelope('round:start', 2, {
        'roundNo': 1,
        'gameType': 'GRID',
        'rows': [for (var i = 0; i < 3; i++) criterion('CLUB')],
        'cols': [for (var i = 0; i < 3; i++) criterion('NATIONALITY')],
        'firstTurnParticipantId': 'p-human',
      }),
    );
    await pumpEventQueue();
    await controller.claimGridCell(const GridCell(row: 0, col: 1), 'زيدان');

    final (event, claim) = socket.sentCommands.last;
    expect(event, 'grid:claim');
    expect(claim['roundNo'], 1);
    expect(claim['cell'], {'row': 0, 'col': 1});
    expect(claim['answer'], {'text': 'زيدان'});
  });

  test('auction commands name the current round', () async {
    final container = await createContainer();
    final controller = controllerOf(container);

    await receiveBattleFound(container);
    socket.receive(
      'round:start',
      battleEnvelope('round:start', 2, {
        'roundNo': 1,
        'gameType': 'AUCTION',
        'lists': [
          for (var i = 0; i < 3; i++)
            {'title': 'list $i', 'answerCount': 6 + i},
        ],
        'pickerParticipantId': 'p-human',
        'pickDeadlineAt': '2026-11-12T10:00:10.000Z',
      }),
    );
    await pumpEventQueue();
    await controller.pickAuctionList(2);
    await controller.bidInAuction(5);
    await controller.callAuctionBid();
    await controller.answerInAuction('صلاح');

    final lastFour = socket.sentCommands.reversed.take(4).toList().reversed;
    expect(
      [for (final (event, _) in lastFour) event],
      ['auction:pick', 'auction:bid', 'auction:call', 'auction:answer'],
    );
    final payloads = [for (final (_, payload) in lastFour) payload];
    expect(payloads[0]['list'], 2);
    expect(payloads[1]['amount'], 5);
    expect(payloads[3]['answer'], {'text': 'صلاح'});
    expect(payloads.every((payload) => payload['roundNo'] == 1), isTrue);
  });

  test(
    'a mine bury keeps the mines from the ack and counts wrong tries',
    () async {
      final container = await createContainer();
      final controller = controllerOf(container);

      await receiveBattleFound(container);
      socket.receive(
        'round:start',
        battleEnvelope('round:start', 2, {
          'roundNo': 1,
          'gameType': 'MINES',
          'criteria': [
            {
              'kind': 'CLUB',
              'entity': {'entityId': 'arsenal', 'name': 'Arsenal'},
            },
            {
              'kind': 'NATIONALITY',
              'entity': {'entityId': 'france', 'name': 'France'},
            },
          ],
          'answerCount': 25,
          'minesPerPlayer': 3,
          'hearts': 3,
          'buryDeadlineAt': '2026-11-12T10:00:30.000Z',
          'firstTurnParticipantId': 'p-human',
        }),
      );
      await pumpEventQueue();
      socket.answerCommand = (_, payload) => BattleCommandAccepted({
        ...payload,
        'accepted': true,
        'data': {
          'mines': [
            {
              'player': {'entityId': 'henry', 'name': 'Thierry Henry'},
              'auto': false,
            },
          ],
          'wrongTriesLeft': 3,
        },
      });
      await controller.buryMine('هنري');

      final (event, payload) = socket.sentCommands.last;
      expect(event, 'mines:bury');
      expect(payload['roundNo'], 1);
      expect(payload['answer'], {'text': 'هنري'});
      MinesRound round() =>
          container.read(battleSessionProvider).battle!.currentRound!
              as MinesRound;
      expect(round().yourMines.single.player.name, 'Thierry Henry');
      expect(round().wrongTriesLeft, 3);

      socket.answerCommand = (_, _) =>
          const BattleCommandRejected('NOT_IN_CATEGORY');
      await controller.buryMine('دروجبا');
      expect(round().wrongTriesLeft, 2);

      await controller.scanForMine('بيريس');
      await controller.answerMines('بيريس');
      expect(socket.sentEventNames.reversed.take(2), [
        'mines:answer',
        'mines:scan',
      ]);
    },
  );

  test(
    'a rock-paper-scissors pick names the current attempt and is remembered',
    () async {
      final container = await createContainer();
      final controller = controllerOf(container);

      expect(
        await controller.pickRockPaperScissors(RockPaperScissorsChoice.rock),
        isA<BattleCommandRejected>(),
      );
      await receiveBattleFound(container);
      socket.receive(
        'battle:rps-start',
        battleEnvelope('battle:rps-start', 2, {
          'attempt': 1,
          'pickDeadlineAt': '2026-11-12T10:00:08.000Z',
        }),
      );
      await pumpEventQueue();
      await controller.pickRockPaperScissors(RockPaperScissorsChoice.paper);

      final (event, payload) = socket.sentCommands.last;
      expect(event, 'battle:rps-pick');
      expect(payload['battleId'], battleId);
      expect(payload['attempt'], 1);
      expect(payload['choice'], 'PAPER');
      expect(
        container.read(battleSessionProvider).battle!.firstMoverDuel!.hasPicked,
        isTrue,
      );
    },
  );

  test('a seq gap sends battle:resync and applies the snapshot', () async {
    final container = await createContainer();
    socket.answerCommand = (event, payload) => event == 'battle:resync'
        ? const BattleCommandAccepted({
            'accepted': true,
            'snapshot': {
              'status': 'IN_PROGRESS',
              'gameType': 'BUZZER',
              'mode': 'MATCHMAKING',
              'players': [humanPlayerJson, botPlayerJson],
              'rounds': <Object>[],
              'scores': [
                {'participantId': 'p-human', 'score': 10},
              ],
              'seq': 7,
            },
          })
        : BattleCommandAccepted({...payload, 'accepted': true});
    await receiveBattleFound(container);

    socket.receive(
      'round:clue',
      battleEnvelope('round:clue', 5, {'roundNo': 1, 'index': 2, 'clue': 'x'}),
    );
    await pumpEventQueue();

    final (event, payload) = socket.sentCommands.single;
    expect(event, 'battle:resync');
    expect(payload['lastSeq'], 1);
    final battle = container.read(battleSessionProvider).battle!;
    expect(battle.needsResync, isFalse);
    expect(battle.lastSeq, 7);
    expect(battle.scores['p-human'], 10);
  });

  test('a resync refused with NOT_PARTICIPANT ends the battle', () async {
    final container = await createContainer();
    socket.answerCommand = (event, payload) => event == 'battle:resync'
        ? const BattleCommandRejected('NOT_PARTICIPANT')
        : BattleCommandAccepted({...payload, 'accepted': true});
    await receiveBattleFound(container);

    socket.receive(
      'round:clue',
      battleEnvelope('round:clue', 5, {'roundNo': 1, 'index': 2, 'clue': 'x'}),
    );
    await pumpEventQueue();

    final battle = container.read(battleSessionProvider).battle!;
    expect(battle.phase, BattlePhase.endedWhileAway);
    expect(battle.isFinished, isTrue);
    expect(battle.needsResync, isFalse);
    expect(battle.currentRound, isNull);
  });

  test('a resync refused for another reason keeps the battle', () async {
    final container = await createContainer();
    socket.answerCommand = (event, payload) => event == 'battle:resync'
        ? const BattleCommandRejected(BattleCommandRejected.noAck)
        : BattleCommandAccepted({...payload, 'accepted': true});
    await receiveBattleFound(container);

    await controllerOf(container).resynchronizeBattle();

    expect(
      container.read(battleSessionProvider).battle?.phase,
      BattlePhase.waitingReady,
    );
  });

  test(
    'connecting synchronizes the clock and resyncs a running battle',
    () async {
      final container = await createContainer();
      socket.answerCommand = (event, payload) => event == 'time:sync'
          ? BattleCommandAccepted({
              't0': payload['t0'],
              'serverTime': deviceNow
                  .add(const Duration(seconds: 2))
                  .toIso8601String(),
            })
          : const BattleCommandRejected('NOT_PARTICIPANT');
      await receiveBattleFound(container);

      socket.changeStatus(BattleSocketStatus.connected);
      await pumpEventQueue();

      final session = container.read(battleSessionProvider);
      expect(session.connection, BattleSocketStatus.connected);
      expect(socket.sentEventNames, [
        ...List.filled(5, 'time:sync'),
        'battle:resync',
      ]);
      expect(session.clock.offset, const Duration(seconds: 2));
    },
  );

  test('a refused handshake refreshes the token once, then reconnects', () async {
    final container = await createContainer();
    controllerOf(container).connect();

    socket.changeStatus(BattleSocketStatus.refused);
    await pumpEventQueue();
    socket.changeStatus(BattleSocketStatus.connecting);
    socket.changeStatus(BattleSocketStatus.refused);
    await pumpEventQueue();

    // One REST call lets the auth interceptor refresh; no second loop after another refusal.
    expect(adapter.sentRequests.map((request) => request.path), ['/v1/me']);
    expect(
      adapter.sentRequests.single.headers['Authorization'],
      'Bearer test-access-token',
    );
    expect(socket.connectCount, 2);
  });

  test('NO_CONTENT clears the queue and is kept for the screen', () async {
    final container = await createContainer();
    socket.receive('matchmaking:queued', {
      'type': 'matchmaking:queued',
      'serverTime': serverTime,
      'data': {'ticketId': 't-1', 'queuedAt': serverTime},
    });
    socket.receive('error', {
      'type': 'error',
      'serverTime': serverTime,
      'data': {'code': 'NO_CONTENT', 'message': 'No battle could be started'},
    });
    await pumpEventQueue();

    final session = container.read(battleSessionProvider);
    expect(session.isQueued, isFalse);
    expect(session.lastServerError?.code, 'NO_CONTENT');
  });

  test('a finished battle is dismissed only once it is finished', () async {
    final container = await createContainer();
    await receiveBattleFound(container);
    final controller = controllerOf(container)..dismissFinishedBattle();
    expect(container.read(battleSessionProvider).battle, isNotNull);

    socket.receive(
      'battle:cancelled',
      battleEnvelope('battle:cancelled', 2, {'reason': 'READY_TIMEOUT'}),
    );
    await pumpEventQueue();
    controller.dismissFinishedBattle();

    expect(container.read(battleSessionProvider).battle, isNull);
  });

  group('resuming after a restart (play-state)', () {
    Map<String, Object?> playStateJson({Object? queue, Object? battle}) => {
      'queue': queue,
      'room': null,
      'battle': battle,
      'serverTime': serverTime,
    };

    test('a queued ticket is restored', () async {
      adapter = FakeHttpAdapter(
        (_) => jsonResponse(
          playStateJson(
            queue: {
              'ticketId': 't-9',
              'gameType': 'CAREER',
              'status': 'QUEUED',
              'queuedAt': serverTime,
              'botFallbackAt': null,
            },
          ),
        ),
      );
      final container = await createContainer();

      final playState = await controllerOf(container).resumePlayState();

      expect(playState.isIdle, isFalse);
      final ticket = container.read(battleSessionProvider).queuedTicket;
      expect(ticket?.ticketId, 't-9');
      expect(ticket?.gameType, GameType.career);
    });

    test(
      'a running battle is rebuilt from a snapshot, with the seat found',
      () async {
        adapter = FakeHttpAdapter(
          (request) => request.path == '/v1/me/play-state'
              ? jsonResponse(
                  playStateJson(
                    battle: {'battleId': battleId, 'status': 'IN_PROGRESS'},
                  ),
                )
              : jsonResponse({...meJson, 'id': 'u-1'}),
        );
        socket.answerCommand = (event, payload) => const BattleCommandAccepted({
          'accepted': true,
          'snapshot': {
            'status': 'IN_PROGRESS',
            'gameType': 'BUZZER',
            'mode': 'MATCHMAKING',
            'players': [humanPlayerJson, botPlayerJson],
            'rounds': <Object>[],
            'scores': <Object>[],
            'seq': 12,
          },
        });
        final container = await createContainer();

        await controllerOf(container).resumePlayState();

        final (event, payload) = socket.sentCommands.single;
        expect(event, 'battle:resync');
        expect(payload['battleId'], battleId);
        final battle = container.read(battleSessionProvider).battle!;
        expect(battle.youParticipantId, 'p-human');
        expect(battle.gameType, GameType.buzzer);
        expect(battle.lastSeq, 12);
        expect(battle.needsResync, isFalse);
      },
    );

    test('REST matchmaking sends the game type and reads the ticket', () async {
      adapter = FakeHttpAdapter(
        (request) => request.method == 'POST'
            ? jsonResponse({
                'ticketId': 't-1',
                'gameType': 'BUZZER',
                'status': 'QUEUED',
                'queuedAt': serverTime,
                'botFallbackAt': '2026-11-12T10:00:05.000Z',
              }, status: 201)
            : jsonResponse(null, status: 204),
      );
      final container = await createContainer();
      final repository = container.read(playStateRepositoryProvider);

      final ticket = await repository.joinMatchmaking(GameType.buzzer);
      await repository.leaveMatchmaking();

      expect(jsonDecode(adapter.sentRequests.first.data as String), {
        'gameType': 'BUZZER',
      });
      expect(ticket.botFallbackAt, DateTime.utc(2026, 11, 12, 10, 0, 5));
      expect(adapter.sentRequests.map((r) => '${r.method} ${r.path}'), [
        'POST /v1/battles/matchmaking',
        'DELETE /v1/battles/matchmaking',
      ]);
    });
  });
}
