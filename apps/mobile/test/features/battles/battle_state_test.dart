import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/battle_state.dart';
import 'package:the_game/features/battles/data/answer_catalog.dart';
import 'package:the_game/features/battles/data/battle_events.dart';

import 'battle_fixtures.dart';

BattleServerEvent event(String type, int seq, Map<String, Object?> data) =>
    parseBattleServerEvent(type, battleEnvelope(type, seq, data));

BattleState foundBattle() => createBattleStateFromFound(
  event('battle:found', 1, {
        'gameType': 'BUZZER',
        'mode': 'MATCHMAKING',
        'players': [humanPlayerJson, botPlayerJson],
        'youParticipantId': 'p-human',
        'config': {'roundCount': 2},
        'readyDeadlineAt': '2026-11-12T10:00:10.000Z',
      })
      as BattleFound,
);

BattleState applyAll(BattleState state, List<BattleServerEvent> events) =>
    events.fold(state, applyBattleEvent);

void main() {
  test('a reveal round: clues, a wrong buzz, a resume, a result', () {
    final state = applyAll(foundBattle(), [
      event('battle:started', 2, {
        'startedAt': '2026-11-12T10:00:03.000Z',
        'players': [humanPlayerJson, botPlayerJson],
      }),
      event('round:start', 3, {
        'roundNo': 1,
        'gameType': 'BUZZER',
        'answerKind': 'PLAYER',
        'stepCount': 3,
      }),
      event('round:clue', 4, {
        'roundNo': 1,
        'index': 1,
        'clue': 'first',
        'nextClueAt': '2026-11-12T10:00:08.000Z',
      }),
      event('round:buzzed', 5, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'answerDeadlineAt': '2026-11-12T10:00:12.000Z',
      }),
    ]);

    final buzzed = state.currentRound! as RevealRound;
    expect(state.phase, BattlePhase.inProgress);
    expect(buzzed.answerKind?.entityKind, AnswerEntityKind.player);
    expect(buzzed.revealedClues, ['first']);
    expect(buzzed.buzzHolderParticipantId, 'p-bot');
    expect(buzzed.nextClueAt, isNull, reason: 'the reveal pauses on a buzz');

    final afterWrong = applyAll(state, [
      event('round:wrong', 6, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'timedOut': true,
      }),
      event('round:resumed', 7, {
        'roundNo': 1,
        'nextClueAt': '2026-11-12T10:00:15.000Z',
      }),
    ]);
    final resumed = afterWrong.currentRound! as RevealRound;
    expect(resumed.buzzHolderParticipantId, isNull);
    expect(resumed.lockedOutParticipantIds, {'p-bot'});
    expect(resumed.nextClueAt, DateTime.utc(2026, 11, 12, 10, 0, 15));

    final ended = applyBattleEvent(
      afterWrong,
      event('round:result', 8, {
        'roundNo': 1,
        'winnerParticipantIds': ['p-human'],
        'reveal': <String, Object?>{},
        'points': [
          {'participantId': 'p-human', 'points': 10},
        ],
        'scores': [
          {'participantId': 'p-human', 'score': 10},
          {'participantId': 'p-bot', 'score': 0},
        ],
      }),
    );
    expect(ended.currentRound, isNull);
    expect(ended.scores, {'p-human': 10, 'p-bot': 0});
    expect(ended.finishedRounds.single.winnerParticipantIds, ['p-human']);
    expect(ended.lastSeq, 8);
  });

  test('a repeated seq is ignored', () {
    final started = event('battle:started', 2, {
      'startedAt': '2026-11-12T10:00:03.000Z',
      'players': [humanPlayerJson, botPlayerJson],
    });
    final clue = event('round:start', 3, {
      'roundNo': 1,
      'gameType': 'BUZZER',
      'answerKind': 'PLAYER',
      'stepCount': 3,
    });

    final state = applyAll(foundBattle(), [started, clue, clue, started]);

    expect(state.lastSeq, 3);
    expect(state.needsResync, isFalse);
  });

  test('a gap asks for a resync and ignores events until the snapshot', () {
    final state = applyAll(foundBattle(), [
      event('round:start', 3, {
        'roundNo': 1,
        'gameType': 'BUZZER',
        'answerKind': 'PLAYER',
        'stepCount': 3,
      }),
      event('battle:started', 2, {
        'startedAt': '2026-11-12T10:00:03.000Z',
        'players': [humanPlayerJson, botPlayerJson],
      }),
    ]);

    expect(state.needsResync, isTrue);
    expect(state.lastSeq, 1);
    expect(state.phase, BattlePhase.waitingReady);
  });

  test('a snapshot replaces the live state and clears the resync flag', () {
    final waiting = applyBattleEvent(
      foundBattle(),
      event('round:clue', 9, {'roundNo': 1, 'index': 2, 'clue': 'x'}),
    );
    expect(waiting.needsResync, isTrue);

    final state = applyBattleSnapshot(waiting, {
      'status': 'IN_PROGRESS',
      'gameType': 'BUZZER',
      'mode': 'MATCHMAKING',
      'players': [humanPlayerJson, botPlayerJson],
      'currentRound': {
        'roundNo': 1,
        'phase': 'REVEALING',
        'stepCount': 3,
        'revealedClues': ['first', 'second'],
        'buzzHolder': null,
        'lockedOut': ['p-bot'],
        'deadlines': {
          'answerDeadlineAt': null,
          'nextClueAt': '2026-11-12T10:00:20.000Z',
        },
      },
      'rounds': <Object>[],
      'scores': [
        {'participantId': 'p-human', 'score': 0},
        {'participantId': 'p-bot', 'score': 0},
      ],
      'seq': 9,
    });

    final round = state.currentRound! as RevealRound;
    expect(state.needsResync, isFalse);
    expect(state.lastSeq, 9);
    expect(state.phase, BattlePhase.inProgress);
    expect(round.revealedClues, ['first', 'second']);
    expect(round.lockedOutParticipantIds, {'p-bot'});
    expect(round.answerKind, isNull, reason: 'a snapshot has no answer kind');

    // Events continue right after the snapshot's seq.
    final next = applyBattleEvent(
      state,
      event('round:clue', 10, {'roundNo': 1, 'index': 3, 'clue': 'third'}),
    );
    expect((next.currentRound! as RevealRound).revealedClues, hasLength(3));
  });

  test('a grid round: turns, claims and a board from a snapshot', () {
    Map<String, Object?> criterion(String kind, String id) => {
      'kind': kind,
      'entity': {'entityId': id, 'name': id},
    };
    final rows = [
      for (final id in ['a', 'b', 'c']) criterion('CLUB', id),
    ];
    final cols = [
      for (final id in ['x', 'y', 'z']) criterion('NATIONALITY', id),
    ];

    final state = applyAll(foundBattle(), [
      event('round:start', 2, {
        'roundNo': 1,
        'gameType': 'GRID',
        'rows': rows,
        'cols': cols,
        'firstTurnParticipantId': 'p-human',
      }),
      event('grid:turn', 3, {
        'roundNo': 1,
        'participantId': 'p-human',
        'turnDeadlineAt': '2026-11-12T10:00:30.000Z',
        'attemptsLeft': 1,
      }),
      event('grid:claimed', 4, {
        'roundNo': 1,
        'cell': {'row': 0, 'col': 2},
        'participantId': 'p-human',
        'player': {'entityId': 'e-1', 'name': 'Salah'},
      }),
    ]);
    final grid = state.currentRound! as GridRound;
    expect(grid.cellOwners, {const GridCell(row: 0, col: 2): 'p-human'});
    expect(grid.attemptsLeft, 1);

    final restored = applyBattleSnapshot(state, {
      'status': 'IN_PROGRESS',
      'gameType': 'GRID',
      'mode': 'MATCHMAKING',
      'players': [humanPlayerJson, botPlayerJson],
      'currentRound': {
        'roundNo': 1,
        'rows': rows,
        'cols': cols,
        'phase': 'TURN',
        'board': [
          {
            'cell': {'row': 0, 'col': 2},
            'owner': 'p-human',
          },
          {
            'cell': {'row': 1, 'col': 1},
            'owner': null,
          },
        ],
        'turnOf': 'p-bot',
        'attemptsLeft': 1,
        'deadlines': {'turnDeadlineAt': '2026-11-12T10:00:45.000Z'},
      },
      'rounds': <Object>[],
      'scores': <Object>[],
      'seq': 6,
    });
    final restoredGrid = restored.currentRound! as GridRound;
    expect(restoredGrid.cellOwners, hasLength(1));
    expect(restoredGrid.turnParticipantId, 'p-bot');
  });

  test('completion, forfeits and other battles', () {
    final state = applyAll(foundBattle(), [
      event('player:forfeited', 2, {
        'participantId': 'p-bot',
        'reason': 'NOT_READY',
      }),
      event('battle:completed', 3, {
        'endReason': 'FORFEIT',
        'you': {'placement': 1, 'outcome': 'WIN', 'score': 0},
        'placements': [
          {'participantId': 'p-human', 'placement': 1, 'score': 0},
          {'participantId': 'p-bot', 'placement': 2, 'score': 0},
        ],
        'pointsPending': false,
      }),
    ]);
    final otherBattle = parseBattleServerEvent('round:clue', {
      ...battleEnvelope('round:clue', 4, {
        'roundNo': 1,
        'index': 1,
        'clue': 'x',
      }),
      'battleId': 'another-battle',
    });

    expect(state.findPlayer('p-bot')?.hasForfeited, isTrue);
    expect(state.phase, BattlePhase.completed);
    expect(state.isFinished, isTrue);
    expect(state.completion?.yourOutcome, BattleOutcome.win);
    expect(applyBattleEvent(state, otherBattle), same(state));
  });
}
