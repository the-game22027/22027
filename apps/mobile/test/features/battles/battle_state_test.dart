import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/battle_state.dart';
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
    expect(buzzed.answerKind?.code, 'PLAYER');
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
        'questionId': 'q-1',
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
    expect(ended.finishedRounds.single.questionId, 'q-1');
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

  group('an auction round', () {
    final lists = [
      {'title': 'هدافو ليفربول في دوري أبطال أوروبا 2018-19', 'answerCount': 9},
      {
        'title': 'هدافو ريال مدريد في دوري أبطال أوروبا 2016-17',
        'answerCount': 12,
      },
      {
        'title': 'صانعو أهداف ليفربول في الدوري الإنجليزي الممتاز 2019-20',
        'answerCount': 15,
      },
    ];
    Map<String, Object?> salah() => {'entityId': 'salah', 'name': 'محمد صلاح'};

    BattleState playAuctionRound() => applyAll(foundBattle(), [
      event('round:start', 2, {
        'roundNo': 1,
        'gameType': 'AUCTION',
        'lists': lists,
        'pickerParticipantId': 'p-bot',
        'pickDeadlineAt': '2026-11-12T10:00:10.000Z',
      }),
      event('auction:picked', 3, {
        'roundNo': 1,
        'list': 0,
        'title': lists[0]['title'],
        'answerCount': 9,
        'auto': false,
      }),
      event('auction:turn', 4, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'currentBid': null,
        'currentBidderId': null,
        'turnDeadlineAt': '2026-11-12T10:00:18.000Z',
      }),
      event('auction:bid', 5, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'amount': 4,
        'allIn': false,
      }),
      event('auction:turn', 6, {
        'roundNo': 1,
        'participantId': 'p-human',
        'currentBid': 4,
        'currentBidderId': 'p-bot',
        'turnDeadlineAt': '2026-11-12T10:00:26.000Z',
      }),
      event('auction:bid', 7, {
        'roundNo': 1,
        'participantId': 'p-human',
        'amount': 7,
        'allIn': false,
      }),
      event('auction:proof', 8, {
        'roundNo': 1,
        'proverParticipantId': 'p-human',
        'amount': 7,
        'maxWrong': 3,
        'proofDeadlineAt': '2026-11-12T10:01:11.000Z',
        'reason': 'CALL',
      }),
      event('auction:answered', 9, {
        'roundNo': 1,
        'participantId': 'p-human',
        'phase': 'PROOF',
        'outcome': 'CORRECT',
        'player': salah(),
        'found': 1,
        'strikes': 0,
      }),
      event('auction:answered', 10, {
        'roundNo': 1,
        'participantId': 'p-human',
        'phase': 'PROOF',
        'outcome': 'REPEATED',
        'player': salah(),
        'found': 1,
        'strikes': 1,
      }),
    ]);

    test(
      'pick, bids, a call, then the proof with a right and a repeated name',
      () {
        final round = playAuctionRound().currentRound! as AuctionRound;
        expect(round.lists.map((list) => list.answerCount), [9, 12, 15]);
        expect(round.phase, AuctionPhase.proving);
        expect(round.pickedList, 0);
        expect(round.currentBid, 7);
        expect(round.proverParticipantId, 'p-human');
        expect(round.maxWrong, 3);
        expect(round.saidNames.single.player.name, 'محمد صلاح');
        expect(round.strikes, 1);
        expect(round.lastAnswer!.outcome, AuctionAnswerOutcome.repeated);
        expect(round.deadline, DateTime.utc(2026, 11, 12, 10, 1, 11));
      },
    );

    test('a bust opens the steal for the other player', () {
      final state = applyAll(playAuctionRound(), [
        event('auction:steal', 11, {
          'roundNo': 1,
          'stealerParticipantId': 'p-bot',
          'names': 1,
          'stealDeadlineAt': '2026-11-12T10:01:30.000Z',
        }),
      ]);
      final round = state.currentRound! as AuctionRound;
      expect(round.phase, AuctionPhase.stealing);
      expect(round.stealerParticipantId, 'p-bot');
    });

    test('a snapshot restores the bidding and the names said', () {
      final restored = applyBattleSnapshot(playAuctionRound(), {
        'status': 'IN_PROGRESS',
        'gameType': 'AUCTION',
        'mode': 'MATCHMAKING',
        'players': [humanPlayerJson, botPlayerJson],
        'currentRound': {
          'roundNo': 1,
          'lists': lists,
          'phase': 'PROVING',
          'picker': 'p-bot',
          'pickedList': 0,
          'bids': [
            {'participantId': 'p-bot', 'amount': 4},
            {'participantId': 'p-human', 'amount': 9},
          ],
          'turnOf': null,
          'prover': 'p-human',
          'amount': 9,
          'allIn': true,
          'maxWrong': 1,
          'found': [
            {'player': salah(), 'saidBy': 'p-human'},
          ],
          'strikes': 0,
          'stealer': null,
          'deadlines': {'proofDeadlineAt': '2026-11-12T10:01:11.000Z'},
        },
        'rounds': <Object>[],
        'scores': <Object>[],
        'seq': 12,
      });
      final round = restored.currentRound! as AuctionRound;
      expect(round.phase, AuctionPhase.proving);
      expect(round.isAllIn, isTrue);
      expect(round.currentBid, 9);
      expect(round.saidNames.single.participantId, 'p-human');
      expect(round.deadline, DateTime.utc(2026, 11, 12, 10, 1, 11));
    });
  });

  group('a vault round', () {
    BattleState playVaultRound() => applyAll(foundBattle(), [
      event('round:start', 2, {
        'roundNo': 1,
        'gameType': 'VAULT',
        'questions': ['سؤال ١؟', 'سؤال ٢؟', 'سؤال ٣؟', 'سؤال ٤؟'],
        'digits': 4,
        'roundDeadlineAt': '2026-11-12T10:02:00.000Z',
        'firstLeakAt': '2026-11-12T10:00:45.000Z',
      }),
      event('vault:tried', 3, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'tries': 1,
      }),
      event('vault:leak', 4, {
        'roundNo': 1,
        'position': 2,
        'digit': 5,
        'nextLeakAt': '2026-11-12T10:01:00.000Z',
      }),
    ]);

    test('the questions, the opponent try count and a leaked digit', () {
      final round = playVaultRound().currentRound! as VaultRound;
      expect(round.questions, hasLength(4));
      expect(round.digits, 4);
      expect(round.triesByParticipant, {'p-bot': 1});
      expect(round.leakedDigits.single.position, 2);
      expect(round.leakedDigits.single.digit, 5);
      expect(round.nextLeakAt, DateTime.utc(2026, 11, 12, 10, 1));
    });

    test('the last leak clears the next leak time', () {
      final state = applyAll(playVaultRound(), [
        event('vault:leak', 5, {
          'roundNo': 1,
          'position': 0,
          'digit': 7,
          'nextLeakAt': null,
        }),
      ]);
      final round = state.currentRound! as VaultRound;
      expect(round.leakedDigits.map((leak) => leak.digit), [5, 7]);
      expect(round.nextLeakAt, isNull);
    });

    test('a snapshot restores leaks, tries and your own lockout', () {
      final restored = applyBattleSnapshot(playVaultRound(), {
        'status': 'IN_PROGRESS',
        'gameType': 'VAULT',
        'mode': 'MATCHMAKING',
        'players': [humanPlayerJson, botPlayerJson],
        'currentRound': {
          'roundNo': 1,
          'questions': ['سؤال ١؟', 'سؤال ٢؟', 'سؤال ٣؟', 'سؤال ٤؟'],
          'digits': 4,
          'leaked': [
            {'position': 2, 'digit': 5},
          ],
          'tries': {'p-human': 2, 'p-bot': 1},
          'lockedUntil': '2026-11-12T10:00:50.000Z',
          'roundDeadlineAt': '2026-11-12T10:02:00.000Z',
          'nextLeakAt': '2026-11-12T10:01:00.000Z',
        },
        'rounds': <Object>[],
        'scores': <Object>[],
        'seq': 6,
      });
      final round = restored.currentRound! as VaultRound;
      expect(round.triesByParticipant, {'p-human': 2, 'p-bot': 1});
      expect(round.yourLockedUntil, DateTime.utc(2026, 11, 12, 10, 0, 50));
      expect(round.leakedDigits.single.digit, 5);
    });
  });

  group('a mines round', () {
    final criteria = [
      {
        'kind': 'CLUB',
        'entity': {'entityId': 'arsenal', 'name': 'Arsenal'},
      },
      {'kind': 'DECADE', 'fromYear': 2000},
    ];
    Map<String, Object?> mine(String id, {bool auto = false}) => {
      'player': {'entityId': id, 'name': id},
      'auto': auto,
      'exploded': false,
    };
    List<Map<String, Object?>> counts(String field, int human, int bot) => [
      {'participantId': 'p-human', field: human},
      {'participantId': 'p-bot', field: bot},
    ];

    BattleState playMinesRound() => applyAll(foundBattle(), [
      event('round:start', 2, {
        'roundNo': 1,
        'gameType': 'MINES',
        'criteria': criteria,
        'answerCount': 30,
        'minesPerPlayer': 3,
        'hearts': 3,
        'buryDeadlineAt': '2026-11-12T10:00:30.000Z',
        'firstTurnParticipantId': 'p-bot',
      }),
      event('mines:turn', 3, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'turnNo': 1,
        'turnDeadlineAt': '2026-11-12T10:00:40.000Z',
        'yourMines': [mine('henry'), mine('pires', auto: true)],
      }),
      event('mines:answered', 4, {
        'roundNo': 1,
        'participantId': 'p-bot',
        'outcome': 'MINE',
        'player': {'entityId': 'henry', 'name': 'henry'},
        'buriedBy': 'p-human',
        'hearts': counts('hearts', 3, 2),
        'answersLeft': 29,
        'minesLeft': counts('minesLeft', 2, 3),
      }),
      event('mines:turn', 5, {
        'roundNo': 1,
        'participantId': 'p-human',
        'turnNo': 2,
        'turnDeadlineAt': '2026-11-12T10:00:50.000Z',
      }),
      event('mines:scanned', 6, {
        'roundNo': 1,
        'participantId': 'p-human',
        'turnDeadlineAt': '2026-11-12T10:00:47.000Z',
        'result': 'CLEAR',
      }),
    ]);

    test(
      'burying, the first turn with your mines, an explosion and a scan',
      () {
        final state = playMinesRound();
        expect(state.phase, BattlePhase.inProgress);
        final round = state.currentRound! as MinesRound;
        expect(round.phase, MinesPhase.turns);
        expect(round.criteria.last.kind, MinesCriterionKind.decade);
        expect(round.criteria.last.fromYear, 2000);
        expect(round.yourMines.map((m) => m.player.entityId), [
          'henry',
          'pires',
        ]);
        expect(round.yourMines.first.hasExploded, isTrue);
        expect(round.yourMines.last.wasBuriedByServer, isTrue);
        expect(round.explodedMines.single.buriedByParticipantId, 'p-human');
        expect(round.heartsByParticipant, {'p-human': 3, 'p-bot': 2});
        expect(round.answersLeft, 29);
        expect(round.turnParticipantId, 'p-human');
        expect(round.turnDeadlineAt, DateTime.utc(2026, 11, 12, 10, 0, 47));
        expect(round.lastScanResult, MineScanResult.clear);
      },
    );

    test('a snapshot restores the round without the other player\'s mines', () {
      final restored = applyBattleSnapshot(playMinesRound(), {
        'status': 'IN_PROGRESS',
        'gameType': 'MINES',
        'mode': 'MATCHMAKING',
        'players': [humanPlayerJson, botPlayerJson],
        'currentRound': {
          'roundNo': 1,
          'criteria': criteria,
          'answerCount': 30,
          'phase': 'TURNS',
          'buryDeadlineAt': '2026-11-12T10:00:30.000Z',
          'yourMines': [mine('henry'), mine('pires')],
          'wrongTriesLeft': 2,
          'exploded': [
            {
              'buriedBy': 'p-human',
              'player': {'entityId': 'henry', 'name': 'henry'},
            },
          ],
          'said': [
            {
              'participantId': 'p-bot',
              'outcome': 'MINE',
              'player': {'entityId': 'henry', 'name': 'henry'},
            },
            {'participantId': 'p-human', 'outcome': 'TIMEOUT'},
          ],
          'hearts': counts('hearts', 2, 2),
          'answersLeft': 29,
          'minesLeft': counts('minesLeft', 2, 3),
          'turnOf': 'p-bot',
          'turnNo': 3,
          'detectorUsesLeft': 0,
          'deadlines': {'turnDeadlineAt': '2026-11-12T10:01:00.000Z'},
        },
        'rounds': <Object>[],
        'scores': <Object>[],
        'seq': 9,
      });
      final round = restored.currentRound! as MinesRound;
      expect(round.phase, MinesPhase.turns);
      expect(round.saidAnswers.last.outcome, MinesAnswerOutcome.timeout);
      expect(round.saidAnswers.last.player, isNull);
      expect(round.wrongTriesLeft, 2);
      expect(round.detectorUsesLeft, 0);
      expect(round.turnNo, 3);
      expect(round.heartsByParticipant['p-human'], 2);
    });
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

  test(
    'rock-paper-scissors: a tie, a winner, then the winner starts the grid',
    () {
      Map<String, Object?> pick(String participantId, String choice) => {
        'participantId': participantId,
        'choice': choice,
        'auto': false,
      };
      final picking = applyAll(foundBattle(), [
        event('battle:started', 2, {
          'startedAt': '2026-11-12T10:00:03.000Z',
          'players': [humanPlayerJson, botPlayerJson],
        }),
        event('battle:rps-start', 3, {
          'attempt': 1,
          'pickDeadlineAt': '2026-11-12T10:00:08.000Z',
        }),
        event('battle:rps-result', 4, {
          'attempt': 1,
          'picks': [pick('p-human', 'ROCK'), pick('p-bot', 'ROCK')],
          'winnerId': null,
          'decidedBy': null,
        }),
        event('battle:rps-start', 5, {
          'attempt': 2,
          'pickDeadlineAt': '2026-11-12T10:00:15.000Z',
        }),
      ]);
      expect(picking.phase, BattlePhase.pickingFirst);
      expect(picking.firstMoverDuel!.attempt, 2);
      expect(picking.firstMoverDuel!.hasPicked, isFalse);
      expect(picking.firstMoverDuel!.results.single.winnerId, isNull);

      final decided = applyAll(picking, [
        event('battle:rps-result', 6, {
          'attempt': 2,
          'picks': [
            pick('p-human', 'PAPER'),
            {'participantId': 'p-bot', 'choice': 'ROCK', 'auto': true},
          ],
          'winnerId': 'p-human',
          'decidedBy': 'RPS',
        }),
      ]);
      expect(decided.firstMoverParticipantId, 'p-human');
      expect(decided.firstMoverDuel!.pickDeadlineAt, isNull);
      expect(
        decided.firstMoverDuel!.results.last.picks.last.wasPickedByServer,
        isTrue,
      );

      final started = applyAll(decided, [
        event('round:start', 7, {
          'roundNo': 1,
          'gameType': 'GRID',
          'rows': const <Object?>[],
          'cols': const <Object?>[],
          'firstTurnParticipantId': 'p-human',
        }),
      ]);
      expect(started.phase, BattlePhase.inProgress);
      expect(started.firstMoverDuel, isNull);
      expect(started.firstMoverParticipantId, 'p-human');
    },
  );

  test(
    'a snapshot during rock-paper-scissors keeps the duel, not a finished battle',
    () {
      final state = applyBattleSnapshot(foundBattle(), {
        'status': 'PICKING_FIRST',
        'gameType': 'GRID',
        'mode': 'MATCHMAKING',
        'players': [humanPlayerJson, botPlayerJson],
        'firstMover': {
          'attempt': 2,
          'pickDeadlineAt': '2026-11-12T10:00:15.000Z',
          'youPicked': true,
          'attempts': [
            {
              'attempt': 1,
              'picks': [
                {
                  'participantId': 'p-human',
                  'choice': 'SCISSORS',
                  'auto': false,
                },
                {'participantId': 'p-bot', 'choice': 'SCISSORS', 'auto': false},
              ],
              'winnerId': null,
            },
          ],
        },
        'rounds': const <Object?>[],
        'scores': const <Object?>[],
        'seq': 9,
      });
      expect(state.phase, BattlePhase.pickingFirst);
      expect(state.firstMoverDuel!.attempt, 2);
      expect(state.firstMoverDuel!.hasPicked, isTrue);
      expect(
        state.firstMoverDuel!.results.single.picks.first.choice,
        RockPaperScissorsChoice.scissors,
      );
    },
  );

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
