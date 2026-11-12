import 'package:the_game/features/battles/data/battle_events.dart';

/// What a battle screen shows, rebuilt from server events only (the server is authoritative,
/// CLAUDE.md §2.6). [applyBattleEvent] and [applyBattleSnapshot] are pure, so every rule
/// about ordering is tested without a socket.

enum BattlePhase { waitingReady, inProgress, cancelled, completed }

sealed class CurrentRound {
  const CurrentRound(this.roundNo);

  final int roundNo;
}

/// A reveal-and-buzz round (`BUZZER`, `CAREER`, `WHO_IS_PLAYER`).
class RevealRound extends CurrentRound {
  const RevealRound({
    required int roundNo,
    required this.answerKind,
    required this.stepCount,
    this.revealedClues = const [],
    this.nextClueAt,
    this.buzzHolderParticipantId,
    this.answerDeadlineAt,
    this.lockedOutParticipantIds = const {},
    this.lastWrongAnswer,
  }) : super(roundNo);

  /// `null` when it is not known (a snapshot does not carry it).
  final RoundAnswerKind? answerKind;
  final int stepCount;

  /// Shown in order of arrival, in the viewer's language.
  final List<String> revealedClues;
  final DateTime? nextClueAt;
  final String? buzzHolderParticipantId;
  final DateTime? answerDeadlineAt;
  final Set<String> lockedOutParticipantIds;
  final WrongAnswerGiven? lastWrongAnswer;

  bool get isFinalWindow => revealedClues.length >= stepCount;

  RevealRound copyWith({
    List<String>? revealedClues,
    DateTime? Function()? nextClueAt,
    String? Function()? buzzHolderParticipantId,
    DateTime? Function()? answerDeadlineAt,
    Set<String>? lockedOutParticipantIds,
    WrongAnswerGiven? lastWrongAnswer,
  }) => RevealRound(
    roundNo: roundNo,
    answerKind: answerKind,
    stepCount: stepCount,
    revealedClues: revealedClues ?? this.revealedClues,
    nextClueAt: nextClueAt == null ? this.nextClueAt : nextClueAt(),
    buzzHolderParticipantId: buzzHolderParticipantId == null
        ? this.buzzHolderParticipantId
        : buzzHolderParticipantId(),
    answerDeadlineAt: answerDeadlineAt == null
        ? this.answerDeadlineAt
        : answerDeadlineAt(),
    lockedOutParticipantIds:
        lockedOutParticipantIds ?? this.lockedOutParticipantIds,
    lastWrongAnswer: lastWrongAnswer ?? this.lastWrongAnswer,
  );
}

/// A `GRID` round: a 3×3 board claimed turn by turn.
class GridRound extends CurrentRound {
  const GridRound({
    required int roundNo,
    required this.rows,
    required this.cols,
    this.cellOwners = const {},
    this.turnParticipantId,
    this.turnDeadlineAt,
    this.attemptsLeft,
    this.lastMiss,
  }) : super(roundNo);

  final List<GridCriterion> rows;
  final List<GridCriterion> cols;

  /// Claimed cells and who claimed them.
  final Map<GridCell, String> cellOwners;
  final String? turnParticipantId;
  final DateTime? turnDeadlineAt;
  final int? attemptsLeft;
  final GridTurnMissed? lastMiss;

  GridRound copyWith({
    Map<GridCell, String>? cellOwners,
    String? turnParticipantId,
    DateTime? turnDeadlineAt,
    int? attemptsLeft,
    GridTurnMissed? lastMiss,
  }) => GridRound(
    roundNo: roundNo,
    rows: rows,
    cols: cols,
    cellOwners: cellOwners ?? this.cellOwners,
    turnParticipantId: turnParticipantId ?? this.turnParticipantId,
    turnDeadlineAt: turnDeadlineAt ?? this.turnDeadlineAt,
    attemptsLeft: attemptsLeft ?? this.attemptsLeft,
    lastMiss: lastMiss ?? this.lastMiss,
  );
}

class BattleState {
  const BattleState({
    required this.battleId,
    required this.gameType,
    required this.isRoomBattle,
    required this.players,
    required this.youParticipantId,
    required this.publicConfig,
    required this.phase,
    required this.lastSeq,
    this.readyDeadlineAt,
    this.currentRound,
    this.scores = const {},
    this.finishedRounds = const [],
    this.disconnectedUntil = const {},
    this.cancellationReason,
    this.completion,
    this.needsResync = false,
  });

  final String battleId;
  final GameType gameType;
  final bool isRoomBattle;
  final List<BattlePlayer> players;
  final String youParticipantId;
  final Map<String, Object?> publicConfig;
  final BattlePhase phase;
  final DateTime? readyDeadlineAt;
  final CurrentRound? currentRound;

  /// Total score by participant id.
  final Map<String, int> scores;
  final List<RoundEnded> finishedRounds;

  /// Disconnected players and the end of their grace period.
  final Map<String, DateTime> disconnectedUntil;
  final String? cancellationReason;
  final BattleCompleted? completion;

  /// The last event applied. Events must follow it without a gap (`WEBSOCKET.md` §2).
  final int lastSeq;

  /// An event was missed: send `battle:resync` and apply the snapshot. Events are ignored
  /// until then.
  final bool needsResync;

  BattlePlayer? findPlayer(String participantId) => players
      .where((player) => player.participantId == participantId)
      .firstOrNull;

  bool get isFinished =>
      phase == BattlePhase.completed || phase == BattlePhase.cancelled;

  BattleState copyWith({
    List<BattlePlayer>? players,
    BattlePhase? phase,
    CurrentRound? Function()? currentRound,
    Map<String, int>? scores,
    List<RoundEnded>? finishedRounds,
    Map<String, DateTime>? disconnectedUntil,
    String? cancellationReason,
    BattleCompleted? completion,
    int? lastSeq,
    bool? needsResync,
  }) => BattleState(
    battleId: battleId,
    gameType: gameType,
    isRoomBattle: isRoomBattle,
    players: players ?? this.players,
    youParticipantId: youParticipantId,
    publicConfig: publicConfig,
    phase: phase ?? this.phase,
    readyDeadlineAt: readyDeadlineAt,
    currentRound: currentRound == null ? this.currentRound : currentRound(),
    scores: scores ?? this.scores,
    finishedRounds: finishedRounds ?? this.finishedRounds,
    disconnectedUntil: disconnectedUntil ?? this.disconnectedUntil,
    cancellationReason: cancellationReason ?? this.cancellationReason,
    completion: completion ?? this.completion,
    lastSeq: lastSeq ?? this.lastSeq,
    needsResync: needsResync ?? this.needsResync,
  );
}

BattleState createBattleStateFromFound(BattleFound found) => BattleState(
  battleId: found.battleId!,
  gameType: found.gameType,
  isRoomBattle: found.isRoomBattle,
  players: found.players,
  youParticipantId: found.youParticipantId,
  publicConfig: found.publicConfig,
  phase: BattlePhase.waitingReady,
  readyDeadlineAt: found.readyDeadlineAt,
  scores: {for (final player in found.players) player.participantId: 0},
  lastSeq: found.seq!,
);

/// Applies one server event. Events of another battle and repeated `seq`s are ignored; a
/// gap marks the state [BattleState.needsResync] instead of applying a later event to a
/// state that missed an earlier one.
BattleState applyBattleEvent(BattleState state, BattleServerEvent event) {
  final seq = event.seq;
  if (event.battleId != state.battleId || seq == null) return state;
  if (state.needsResync || seq <= state.lastSeq) return state;
  if (seq > state.lastSeq + 1) return state.copyWith(needsResync: true);

  final next = _applyInOrder(state, event);
  return next.copyWith(lastSeq: seq);
}

BattleState _applyInOrder(BattleState state, BattleServerEvent event) {
  final round = state.currentRound;
  switch (event) {
    case BattleStarted(:final players):
      return state.copyWith(phase: BattlePhase.inProgress, players: players);
    case BattleCancelled(:final reason):
      return state.copyWith(
        phase: BattlePhase.cancelled,
        cancellationReason: reason,
        currentRound: () => null,
      );
    case RevealRoundStarted():
      return state.copyWith(
        currentRound: () => RevealRound(
          roundNo: event.roundNo,
          answerKind: event.answerKind,
          stepCount: event.stepCount,
        ),
      );
    case GridRoundStarted():
      return state.copyWith(
        currentRound: () => GridRound(
          roundNo: event.roundNo,
          rows: event.rows,
          cols: event.cols,
          turnParticipantId: event.firstTurnParticipantId,
        ),
      );
    case ClueRevealed() when round is RevealRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          revealedClues: [...round.revealedClues, event.clue],
          nextClueAt: () => event.nextClueAt,
        ),
      );
    case RoundBuzzed() when round is RevealRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          buzzHolderParticipantId: () => event.participantId,
          answerDeadlineAt: () => event.answerDeadlineAt,
          // The reveal is paused while someone holds the buzz.
          nextClueAt: () => null,
        ),
      );
    case WrongAnswerGiven() when round is RevealRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          buzzHolderParticipantId: () => null,
          answerDeadlineAt: () => null,
          lockedOutParticipantIds: {
            ...round.lockedOutParticipantIds,
            event.participantId,
          },
          lastWrongAnswer: event,
        ),
      );
    case RevealResumed() when round is RevealRound:
      return state.copyWith(
        currentRound: () => round.copyWith(nextClueAt: () => event.nextClueAt),
      );
    case GridTurnStarted() when round is GridRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          turnParticipantId: event.participantId,
          turnDeadlineAt: event.turnDeadlineAt,
          attemptsLeft: event.attemptsLeft,
        ),
      );
    case GridCellClaimed() when round is GridRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          cellOwners: {...round.cellOwners, event.cell: event.participantId},
        ),
      );
    case GridTurnMissed() when round is GridRound:
      return state.copyWith(
        currentRound: () => round.copyWith(lastMiss: event),
      );
    case RoundEnded():
      return state.copyWith(
        scores: {
          ...state.scores,
          for (final score in event.scores) score.participantId: score.score,
        },
        finishedRounds: [...state.finishedRounds, event],
        currentRound: () => null,
      );
    case PlayerDisconnected():
      return state.copyWith(
        disconnectedUntil: {
          ...state.disconnectedUntil,
          event.participantId: event.graceUntil,
        },
      );
    case PlayerReconnected():
      return state.copyWith(
        disconnectedUntil: {...state.disconnectedUntil}
          ..remove(event.participantId),
      );
    case PlayerForfeited():
      return state.copyWith(
        players: [
          for (final player in state.players)
            player.participantId == event.participantId
                ? BattlePlayer(
                    participantId: player.participantId,
                    kind: player.kind,
                    seat: player.seat,
                    displayName: player.displayName,
                    userId: player.userId,
                    avatarUrl: player.avatarUrl,
                    hasForfeited: true,
                  )
                : player,
        ],
        disconnectedUntil: {...state.disconnectedUntil}
          ..remove(event.participantId),
      );
    case BattleCompleted():
      return state.copyWith(
        phase: BattlePhase.completed,
        completion: event,
        currentRound: () => null,
      );
    // A round event for another kind of round, a repeated battle:found, an unknown event:
    // nothing to change, but the seq still counts.
    default:
      return state;
  }
}

/// Replaces the live part of [state] with a `battle:snapshot` (the `battle:resync` ack).
/// Throws [FormatException] when the snapshot breaks the contract.
BattleState applyBattleSnapshot(BattleState state, Object? snapshotJson) {
  final snapshot = JsonObjectReader(snapshotJson, 'battle:snapshot');
  final roundJson = snapshot.readOptionalObject('currentRound');
  final scores = readParticipantScores(snapshot.readObjectList('scores'));
  final status = snapshot.readString('status');

  return BattleState(
    battleId: state.battleId,
    gameType: state.gameType,
    isRoomBattle: state.isRoomBattle,
    players: readBattlePlayers(snapshot.readObjectList('players')),
    youParticipantId: state.youParticipantId,
    publicConfig: state.publicConfig,
    phase: switch (status) {
      'WAITING_READY' => BattlePhase.waitingReady,
      'IN_PROGRESS' => BattlePhase.inProgress,
      // The completion details came (or will come) with battle:completed.
      _ =>
        state.phase == BattlePhase.cancelled
            ? BattlePhase.cancelled
            : BattlePhase.completed,
    },
    readyDeadlineAt: state.readyDeadlineAt,
    currentRound: roundJson == null
        ? null
        : _readSnapshotRound(roundJson, state.currentRound),
    scores: {for (final score in scores) score.participantId: score.score},
    // Past rounds keep the details the app saw; the snapshot only lists winners.
    finishedRounds: state.finishedRounds,
    disconnectedUntil: state.disconnectedUntil,
    cancellationReason: state.cancellationReason,
    completion: state.completion,
    lastSeq: snapshot.readInt('seq'),
  );
}

CurrentRound? _readSnapshotRound(
  JsonObjectReader round,
  CurrentRound? previous,
) {
  final roundNo = round.readInt('roundNo');
  if (round.json.containsKey('rows')) {
    final grid = GridRound(
      roundNo: roundNo,
      rows: readGridCriteria(round.readObjectList('rows')),
      cols: readGridCriteria(round.readObjectList('cols')),
    );
    if (!round.json.containsKey('board')) return grid;
    final deadlines = round.readOptionalObject('deadlines');
    return GridRound(
      roundNo: roundNo,
      rows: grid.rows,
      cols: grid.cols,
      cellOwners: {
        for (final cell in round.readObjectList('board'))
          readGridCell(cell.readObject('cell')): ?cell.readOptionalString(
            'owner',
          ),
      },
      turnParticipantId: round.readOptionalString('turnOf'),
      turnDeadlineAt: deadlines?.readOptionalTimestamp('turnDeadlineAt'),
      attemptsLeft: round.readOptionalInt('attemptsLeft'),
    );
  }
  if (!round.json.containsKey('stepCount')) return null;
  final deadlines = round.readOptionalObject('deadlines');
  return RevealRound(
    roundNo: roundNo,
    answerKind: previous is RevealRound && previous.roundNo == roundNo
        ? previous.answerKind
        : null,
    stepCount: round.readInt('stepCount'),
    revealedClues: round.readStringList('revealedClues'),
    nextClueAt: deadlines?.readOptionalTimestamp('nextClueAt'),
    buzzHolderParticipantId: round.readOptionalString('buzzHolder'),
    answerDeadlineAt: deadlines?.readOptionalTimestamp('answerDeadlineAt'),
    lockedOutParticipantIds: round.readStringList('lockedOut').toSet(),
  );
}
