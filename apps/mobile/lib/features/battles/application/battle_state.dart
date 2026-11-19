import 'package:the_game/features/battles/data/battle_events.dart';

/// What a battle screen shows, rebuilt from server events only (the server is authoritative,
/// CLAUDE.md §2.6). [applyBattleEvent] and [applyBattleSnapshot] are pure, so every rule
/// about ordering is tested without a socket.

enum BattlePhase {
  waitingReady,

  /// Rock-paper-scissors decides who moves first, before round 1 (`08` §9.1).
  pickingFirst,
  inProgress,
  cancelled,
  completed,

  /// The server no longer runs this battle, and the app missed how it ended (for example
  /// the socket was down when `battle:completed` was sent, or the server restarted and
  /// abandoned it). The result is not known here.
  endedWhileAway,
}

/// One finished rock-paper-scissors attempt.
class RockPaperScissorsAttemptResult {
  const RockPaperScissorsAttemptResult({
    required this.attempt,
    required this.picks,
    this.winnerId,
  });

  final int attempt;
  final List<RockPaperScissorsPick> picks;

  /// Null for a tie.
  final String? winnerId;
}

/// The rock-paper-scissors duel as the server revealed it.
class FirstMoverDuel {
  const FirstMoverDuel({
    required this.attempt,
    this.pickDeadlineAt,
    this.hasPicked = false,
    this.results = const [],
  });

  final int attempt;

  /// Null between a result and the next attempt.
  final DateTime? pickDeadlineAt;

  /// The server took this player's pick for [attempt].
  final bool hasPicked;

  /// Finished attempts, ties included, oldest first.
  final List<RockPaperScissorsAttemptResult> results;

  FirstMoverDuel copyWith({
    DateTime? Function()? pickDeadlineAt,
    bool? hasPicked,
    List<RockPaperScissorsAttemptResult>? results,
  }) => FirstMoverDuel(
    attempt: attempt,
    pickDeadlineAt: pickDeadlineAt == null
        ? this.pickDeadlineAt
        : pickDeadlineAt(),
    hasPicked: hasPicked ?? this.hasPicked,
    results: results ?? this.results,
  );
}

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

enum AuctionPhase { picking, bidding, proving, stealing, closed }

/// A bid in an AUCTION round.
class AuctionBid {
  const AuctionBid({required this.participantId, required this.amount});

  final String participantId;
  final int amount;
}

/// A right name said in an AUCTION round, and who said it.
class AuctionSaidName {
  const AuctionSaidName({required this.player, required this.participantId});

  final EntityRef player;
  final String participantId;
}

/// An `AUCTION` round (`08` §11): pick a list, bid, prove it live, maybe a steal.
class AuctionRound extends CurrentRound {
  const AuctionRound({
    required int roundNo,
    required this.lists,
    required this.phase,
    required this.pickerParticipantId,
    this.pickedList,
    this.bids = const [],
    this.turnParticipantId,
    this.deadline,
    this.proverParticipantId,
    this.amount,
    this.isAllIn = false,
    this.maxWrong,
    this.saidNames = const [],
    this.strikes = 0,
    this.stealerParticipantId,
    this.lastAnswer,
  }) : super(roundNo);

  final List<AuctionListOffer> lists;
  final AuctionPhase phase;
  final String pickerParticipantId;
  final int? pickedList;
  final List<AuctionBid> bids;
  final String? turnParticipantId;

  /// The current phase's deadline: pick, bidding turn, proof or steal.
  final DateTime? deadline;
  final String? proverParticipantId;
  final int? amount;
  final bool isAllIn;
  final int? maxWrong;
  final List<AuctionSaidName> saidNames;
  final int strikes;
  final String? stealerParticipantId;
  final AuctionAnswered? lastAnswer;

  int? get currentBid => bids.isEmpty ? null : bids.last.amount;

  AuctionRound copyWith({
    AuctionPhase? phase,
    int? pickedList,
    List<AuctionBid>? bids,
    String? turnParticipantId,
    DateTime? deadline,
    String? proverParticipantId,
    int? amount,
    bool? isAllIn,
    int? maxWrong,
    List<AuctionSaidName>? saidNames,
    int? strikes,
    String? stealerParticipantId,
    AuctionAnswered? lastAnswer,
  }) => AuctionRound(
    roundNo: roundNo,
    lists: lists,
    phase: phase ?? this.phase,
    pickerParticipantId: pickerParticipantId,
    pickedList: pickedList ?? this.pickedList,
    bids: bids ?? this.bids,
    turnParticipantId: turnParticipantId ?? this.turnParticipantId,
    deadline: deadline ?? this.deadline,
    proverParticipantId: proverParticipantId ?? this.proverParticipantId,
    amount: amount ?? this.amount,
    isAllIn: isAllIn ?? this.isAllIn,
    maxWrong: maxWrong ?? this.maxWrong,
    saidNames: saidNames ?? this.saidNames,
    strikes: strikes ?? this.strikes,
    stealerParticipantId: stealerParticipantId ?? this.stealerParticipantId,
    lastAnswer: lastAnswer ?? this.lastAnswer,
  );
}

enum HexPhase { picking, racing, closed }

/// A `HEX` board (`08` §13): pick a cell, race on its question, connect your two sides.
class HexRound extends CurrentRound {
  const HexRound({
    required int roundNo,
    required this.size,
    required this.board,
    required this.owners,
    required this.sides,
    required this.phase,
    required this.turnParticipantId,
    required this.deadline,
    required this.clearsLeft,
    this.racingCell,
    this.question,
    this.letter,
    this.lockedUntil = const {},
    this.lastRightNames = const [],
  }) : super(roundNo);

  final int size;

  /// Each cell's letter in your language, row by row.
  final List<String> board;

  /// Owner of each cell; null when open.
  final List<String?> owners;
  final Map<String, HexSide> sides;
  final HexPhase phase;

  /// Whose pick it is, or who picked the cell being raced.
  final String turnParticipantId;

  /// The pick deadline or the answer deadline.
  final DateTime deadline;
  final Map<String, int> clearsLeft;
  final int? racingCell;
  final String? question;
  final String? letter;

  /// Lockouts of the current race, per participant.
  final Map<String, DateTime> lockedUntil;

  /// The other right names of the last race (for your letter).
  final List<EntityRef> lastRightNames;

  HexRound copyWith({
    List<String?>? owners,
    HexPhase? phase,
    String? turnParticipantId,
    DateTime? deadline,
    Map<String, int>? clearsLeft,
    int? Function()? racingCell,
    String? Function()? question,
    String? Function()? letter,
    Map<String, DateTime>? lockedUntil,
    List<EntityRef>? lastRightNames,
  }) => HexRound(
    roundNo: roundNo,
    size: size,
    board: board,
    owners: owners ?? this.owners,
    sides: sides,
    phase: phase ?? this.phase,
    turnParticipantId: turnParticipantId ?? this.turnParticipantId,
    deadline: deadline ?? this.deadline,
    clearsLeft: clearsLeft ?? this.clearsLeft,
    racingCell: racingCell != null ? racingCell() : this.racingCell,
    question: question != null ? question() : this.question,
    letter: letter != null ? letter() : this.letter,
    lockedUntil: lockedUntil ?? this.lockedUntil,
    lastRightNames: lastRightNames ?? this.lastRightNames,
  );
}

/// One slot of a `LINEUP` board as the app shows it.
class LineupSlotView {
  const LineupSlotView({required this.spec, this.placed, this.placedBy});

  final LineupSlotSpec spec;

  /// The player once his name is on the board.
  final EntityRef? placed;

  /// Who typed it; null when nobody did (a real shown name placed after the fake was found).
  final String? placedBy;

  LineupSlotView place(EntityRef player, String? by) =>
      LineupSlotView(spec: spec, placed: player, placedBy: by);
}

/// A `LINEUP` round (`08` §14): everyone fills the same XI; the first right name takes a slot.
class LineupRound extends CurrentRound {
  const LineupRound({
    required int roundNo,
    required this.title,
    required this.slots,
    required this.shown,
    required this.roundDeadlineAt,
    this.hintsAt,
    this.letters = const {},
    this.fake,
    this.fakeUnmaskedBy,
    this.yourLockedUntil,
    this.hasUsedYourAccusation = false,
  }) : super(roundNo);

  final String title;
  final List<LineupSlotView> slots;
  final List<EntityRef> shown;
  final DateTime roundDeadlineAt;
  final DateTime? hintsAt;

  /// First letters of the empty slots once the hints are out: slot → letter.
  final Map<int, String> letters;

  /// The fake, once someone unmasked it.
  final EntityRef? fake;
  final String? fakeUnmaskedBy;

  /// From your last wrong name's ack; the server refuses `LOCKED_OUT` until then.
  final DateTime? yourLockedUntil;

  /// Typing a shown name is your one accusation of the round (DEC-80).
  final bool hasUsedYourAccusation;

  LineupRound copyWith({
    List<LineupSlotView>? slots,
    Map<int, String>? letters,
    EntityRef? Function()? fake,
    String? Function()? fakeUnmaskedBy,
    DateTime? Function()? yourLockedUntil,
    bool? hasUsedYourAccusation,
  }) => LineupRound(
    roundNo: roundNo,
    title: title,
    slots: slots ?? this.slots,
    shown: shown,
    roundDeadlineAt: roundDeadlineAt,
    hintsAt: hintsAt,
    letters: letters ?? this.letters,
    fake: fake != null ? fake() : this.fake,
    fakeUnmaskedBy: fakeUnmaskedBy != null
        ? fakeUnmaskedBy()
        : this.fakeUnmaskedBy,
    yourLockedUntil: yourLockedUntil != null
        ? yourLockedUntil()
        : this.yourLockedUntil,
    hasUsedYourAccusation: hasUsedYourAccusation ?? this.hasUsedYourAccusation,
  );
}

/// A digit of a `VAULT` code revealed to everyone.
class VaultLeakedDigit {
  const VaultLeakedDigit({required this.position, required this.digit});

  final int position;
  final int digit;
}

/// A `VAULT` round (`08` §12): everyone races to type the whole code; a wrong try locks only you out.
class VaultRound extends CurrentRound {
  const VaultRound({
    required int roundNo,
    required this.questions,
    required this.digits,
    required this.roundDeadlineAt,
    this.leakedDigits = const [],
    this.triesByParticipant = const {},
    this.yourLockedUntil,
    this.nextLeakAt,
  }) : super(roundNo);

  final List<String> questions;
  final int digits;
  final DateTime roundDeadlineAt;
  final List<VaultLeakedDigit> leakedDigits;

  /// Wrong tries per participant: all a player ever sees of the others' tries.
  final Map<String, int> triesByParticipant;

  /// From your last wrong try's ack; the server refuses `LOCKED_OUT` until then.
  final DateTime? yourLockedUntil;
  final DateTime? nextLeakAt;

  VaultRound copyWith({
    List<VaultLeakedDigit>? leakedDigits,
    Map<String, int>? triesByParticipant,
    DateTime? Function()? yourLockedUntil,
    DateTime? Function()? nextLeakAt,
  }) => VaultRound(
    roundNo: roundNo,
    questions: questions,
    digits: digits,
    roundDeadlineAt: roundDeadlineAt,
    leakedDigits: leakedDigits ?? this.leakedDigits,
    triesByParticipant: triesByParticipant ?? this.triesByParticipant,
    yourLockedUntil: yourLockedUntil != null
        ? yourLockedUntil()
        : this.yourLockedUntil,
    nextLeakAt: nextLeakAt != null ? nextLeakAt() : this.nextLeakAt,
  );
}

enum MinesPhase { burying, turns, closed }

/// A name said in a `MINES` round; [player] is missing when the server hides it.
class MinesSaidAnswer {
  const MinesSaidAnswer({
    required this.participantId,
    required this.outcome,
    this.player,
  });

  final String participantId;
  final MinesAnswerOutcome outcome;
  final EntityRef? player;
}

/// A mine that went off, and who buried it.
class ExplodedMine {
  const ExplodedMine({
    required this.buriedByParticipantId,
    required this.player,
  });

  final String buriedByParticipantId;
  final EntityRef player;
}

/// A `MINES` round (`08` §10): secret burying, then turns with hearts.
class MinesRound extends CurrentRound {
  const MinesRound({
    required int roundNo,
    required this.criteria,
    required this.answerCount,
    required this.phase,
    this.buryDeadlineAt,
    this.yourMines = const [],
    this.wrongTriesLeft,
    this.explodedMines = const [],
    this.saidAnswers = const [],
    this.heartsByParticipant = const {},
    this.answersLeft,
    this.minesLeftByParticipant = const {},
    this.turnParticipantId,
    this.turnNo = 0,
    this.turnDeadlineAt,
    this.detectorUsesLeft,
    this.lastScanResult,
  }) : super(roundNo);

  final List<MinesCriterion> criteria;
  final int answerCount;
  final MinesPhase phase;
  final DateTime? buryDeadlineAt;

  /// Only your own mines: the other player's stay on the server until they explode.
  final List<MineRef> yourMines;

  /// `null` until the server says (bury ack or snapshot).
  final int? wrongTriesLeft;
  final List<ExplodedMine> explodedMines;
  final List<MinesSaidAnswer> saidAnswers;
  final Map<String, int> heartsByParticipant;
  final int? answersLeft;
  final Map<String, int> minesLeftByParticipant;
  final String? turnParticipantId;
  final int turnNo;
  final DateTime? turnDeadlineAt;

  /// Your detector uses left; `null` until the server says (snapshot).
  final int? detectorUsesLeft;

  /// Your last detector answer in this round.
  final MineScanResult? lastScanResult;

  MinesRound copyWith({
    MinesPhase? phase,
    List<MineRef>? yourMines,
    int? wrongTriesLeft,
    List<ExplodedMine>? explodedMines,
    List<MinesSaidAnswer>? saidAnswers,
    Map<String, int>? heartsByParticipant,
    int? answersLeft,
    Map<String, int>? minesLeftByParticipant,
    String? turnParticipantId,
    int? turnNo,
    DateTime? turnDeadlineAt,
    int? detectorUsesLeft,
    MineScanResult? lastScanResult,
  }) => MinesRound(
    roundNo: roundNo,
    criteria: criteria,
    answerCount: answerCount,
    phase: phase ?? this.phase,
    buryDeadlineAt: buryDeadlineAt,
    yourMines: yourMines ?? this.yourMines,
    wrongTriesLeft: wrongTriesLeft ?? this.wrongTriesLeft,
    explodedMines: explodedMines ?? this.explodedMines,
    saidAnswers: saidAnswers ?? this.saidAnswers,
    heartsByParticipant: heartsByParticipant ?? this.heartsByParticipant,
    answersLeft: answersLeft ?? this.answersLeft,
    minesLeftByParticipant:
        minesLeftByParticipant ?? this.minesLeftByParticipant,
    turnParticipantId: turnParticipantId ?? this.turnParticipantId,
    turnNo: turnNo ?? this.turnNo,
    turnDeadlineAt: turnDeadlineAt ?? this.turnDeadlineAt,
    detectorUsesLeft: detectorUsesLeft ?? this.detectorUsesLeft,
    lastScanResult: lastScanResult ?? this.lastScanResult,
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
    this.firstMoverDuel,
    this.firstMoverParticipantId,
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

  /// Set while [BattlePhase.pickingFirst].
  final FirstMoverDuel? firstMoverDuel;

  /// Who moves first in the current round; null for games where everyone plays at once.
  final String? firstMoverParticipantId;
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
      phase == BattlePhase.completed ||
      phase == BattlePhase.cancelled ||
      phase == BattlePhase.endedWhileAway;

  BattleState copyWith({
    List<BattlePlayer>? players,
    BattlePhase? phase,
    FirstMoverDuel? Function()? firstMoverDuel,
    String? firstMoverParticipantId,
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
    firstMoverDuel: firstMoverDuel == null
        ? this.firstMoverDuel
        : firstMoverDuel(),
    firstMoverParticipantId:
        firstMoverParticipantId ?? this.firstMoverParticipantId,
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
    case RockPaperScissorsStarted():
      return state.copyWith(
        phase: BattlePhase.pickingFirst,
        firstMoverDuel: () => FirstMoverDuel(
          attempt: event.attempt,
          pickDeadlineAt: event.pickDeadlineAt,
          results: state.firstMoverDuel?.results ?? const [],
        ),
      );
    case RockPaperScissorsResult():
      final duel =
          state.firstMoverDuel ?? FirstMoverDuel(attempt: event.attempt);
      return state.copyWith(
        firstMoverDuel: () => duel.copyWith(
          pickDeadlineAt: () => null,
          results: [
            ...duel.results,
            RockPaperScissorsAttemptResult(
              attempt: event.attempt,
              picks: event.picks,
              winnerId: event.winnerId,
            ),
          ],
        ),
        firstMoverParticipantId: event.winnerId,
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
        phase: BattlePhase.inProgress,
        firstMoverDuel: () => null,
        firstMoverParticipantId: event.firstTurnParticipantId,
        currentRound: () => GridRound(
          roundNo: event.roundNo,
          rows: event.rows,
          cols: event.cols,
          turnParticipantId: event.firstTurnParticipantId,
        ),
      );
    case HexRoundStarted():
      return state.copyWith(
        phase: BattlePhase.inProgress,
        firstMoverDuel: () => null,
        firstMoverParticipantId: event.firstPickerParticipantId,
        currentRound: () => HexRound(
          roundNo: event.roundNo,
          size: event.size,
          board: event.board,
          owners: List<String?>.filled(event.board.length, null),
          sides: event.sides,
          phase: HexPhase.picking,
          turnParticipantId: event.firstPickerParticipantId,
          deadline: event.pickDeadlineAt,
          clearsLeft: event.clearsLeft,
        ),
      );
    case HexTurnStarted() when round is HexRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          phase: HexPhase.picking,
          turnParticipantId: event.participantId,
          deadline: event.pickDeadlineAt,
          racingCell: () => null,
          question: () => null,
          letter: () => null,
          lockedUntil: const {},
        ),
      );
    case HexRaceStarted() when round is HexRound:
      final owners = [...round.owners];
      if (event.wasCleared) owners[event.cell] = null;
      return state.copyWith(
        currentRound: () => round.copyWith(
          owners: owners,
          phase: HexPhase.racing,
          turnParticipantId: event.pickedBy,
          deadline: event.answerDeadlineAt,
          clearsLeft: event.wasCleared
              ? {
                  ...round.clearsLeft,
                  event.pickedBy: (round.clearsLeft[event.pickedBy] ?? 1) - 1,
                }
              : null,
          racingCell: () => event.cell,
          question: () => event.question,
          letter: () => event.letter,
          lockedUntil: const {},
        ),
      );
    case HexWrongAnswer() when round is HexRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          lockedUntil: {
            ...round.lockedUntil,
            event.participantId: event.lockedUntil,
          },
        ),
      );
    case HexCellClaimed() when round is HexRound:
      final owners = [...round.owners];
      owners[event.cell] = event.participantId;
      return state.copyWith(
        currentRound: () => round.copyWith(
          owners: owners,
          racingCell: () => null,
          lastRightNames: event.rightNames,
        ),
      );
    case HexRaceExpired() when round is HexRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          racingCell: () => null,
          lastRightNames: event.rightNames,
        ),
      );
    case LineupRoundStarted():
      return state.copyWith(
        phase: BattlePhase.inProgress,
        firstMoverDuel: () => null,
        currentRound: () => LineupRound(
          roundNo: event.roundNo,
          title: event.title,
          slots: [for (final spec in event.slots) LineupSlotView(spec: spec)],
          shown: event.shown,
          roundDeadlineAt: event.roundDeadlineAt,
          hintsAt: event.hintsAt,
        ),
      );
    case LineupNamePlaced() when round is LineupRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          slots: [
            for (final slot in round.slots)
              slot.spec.slot == event.slot
                  ? slot.place(event.player, event.participantId)
                  : slot,
          ],
          letters: {...round.letters}..remove(event.slot),
        ),
      );
    case LineupAccused() when round is LineupRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          fake: event.isRight ? () => event.player : null,
          fakeUnmaskedBy: event.isRight ? () => event.participantId : null,
          hasUsedYourAccusation: event.participantId == state.youParticipantId
              ? true
              : null,
        ),
      );
    case LineupHintsGiven() when round is LineupRound:
      return state.copyWith(
        currentRound: () => round.copyWith(letters: event.letters),
      );
    case VaultRoundStarted():
      return state.copyWith(
        phase: BattlePhase.inProgress,
        firstMoverDuel: () => null,
        currentRound: () => VaultRound(
          roundNo: event.roundNo,
          questions: event.questions,
          digits: event.digits,
          roundDeadlineAt: event.roundDeadlineAt,
          nextLeakAt: event.firstLeakAt,
        ),
      );
    case VaultTried() when round is VaultRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          triesByParticipant: {
            ...round.triesByParticipant,
            event.participantId: event.tries,
          },
        ),
      );
    case VaultDigitLeaked() when round is VaultRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          leakedDigits: [
            ...round.leakedDigits,
            VaultLeakedDigit(position: event.position, digit: event.digit),
          ],
          nextLeakAt: () => event.nextLeakAt,
        ),
      );
    case AuctionRoundStarted():
      return state.copyWith(
        phase: BattlePhase.inProgress,
        firstMoverDuel: () => null,
        firstMoverParticipantId: event.pickerParticipantId,
        currentRound: () => AuctionRound(
          roundNo: event.roundNo,
          lists: event.lists,
          phase: AuctionPhase.picking,
          pickerParticipantId: event.pickerParticipantId,
          deadline: event.pickDeadlineAt,
        ),
      );
    case AuctionListPicked() when round is AuctionRound:
      return state.copyWith(
        currentRound: () =>
            round.copyWith(phase: AuctionPhase.bidding, pickedList: event.list),
      );
    case AuctionTurnStarted() when round is AuctionRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          phase: AuctionPhase.bidding,
          turnParticipantId: event.participantId,
          deadline: event.turnDeadlineAt,
        ),
      );
    case AuctionBidPlaced() when round is AuctionRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          bids: [
            ...round.bids,
            AuctionBid(
              participantId: event.participantId,
              amount: event.amount,
            ),
          ],
        ),
      );
    case AuctionProofStarted() when round is AuctionRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          phase: AuctionPhase.proving,
          proverParticipantId: event.proverParticipantId,
          amount: event.amount,
          isAllIn: event.reason == AuctionProofReason.allIn,
          maxWrong: event.maxWrong,
          deadline: event.proofDeadlineAt,
        ),
      );
    case AuctionAnswered() when round is AuctionRound:
      final player = event.player;
      return state.copyWith(
        currentRound: () => round.copyWith(
          saidNames:
              event.outcome == AuctionAnswerOutcome.correct && player != null
              ? [
                  ...round.saidNames,
                  AuctionSaidName(
                    player: player,
                    participantId: event.participantId,
                  ),
                ]
              : null,
          strikes: event.strikes,
          lastAnswer: event,
        ),
      );
    case AuctionStealStarted() when round is AuctionRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          phase: AuctionPhase.stealing,
          stealerParticipantId: event.stealerParticipantId,
          deadline: event.stealDeadlineAt,
        ),
      );
    case MinesRoundStarted():
      return state.copyWith(
        phase: BattlePhase.inProgress,
        firstMoverDuel: () => null,
        firstMoverParticipantId: event.firstTurnParticipantId,
        currentRound: () => MinesRound(
          roundNo: event.roundNo,
          criteria: event.criteria,
          answerCount: event.answerCount,
          phase: MinesPhase.burying,
          buryDeadlineAt: event.buryDeadlineAt,
          answersLeft: event.answerCount,
          heartsByParticipant: {
            for (final player in state.players)
              if (!player.hasForfeited) player.participantId: event.hearts,
          },
          turnParticipantId: event.firstTurnParticipantId,
        ),
      );
    case MinesTurnStarted() when round is MinesRound:
      return state.copyWith(
        currentRound: () => round.copyWith(
          phase: MinesPhase.turns,
          turnParticipantId: event.participantId,
          turnNo: event.turnNo,
          turnDeadlineAt: event.turnDeadlineAt,
          yourMines: event.yourMines,
        ),
      );
    case MinesAnswered() when round is MinesRound:
      final player = event.player;
      final buriedBy = event.buriedByParticipantId;
      return state.copyWith(
        currentRound: () => round.copyWith(
          saidAnswers: [
            ...round.saidAnswers,
            MinesSaidAnswer(
              participantId: event.participantId,
              outcome: event.outcome,
              player: player,
            ),
          ],
          explodedMines:
              event.outcome == MinesAnswerOutcome.mine &&
                  player != null &&
                  buriedBy != null
              ? [
                  ...round.explodedMines,
                  ExplodedMine(buriedByParticipantId: buriedBy, player: player),
                ]
              : null,
          yourMines: buriedBy == state.youParticipantId && player != null
              ? [
                  for (final mine in round.yourMines)
                    mine.player.entityId == player.entityId
                        ? MineRef(
                            player: mine.player,
                            wasBuriedByServer: mine.wasBuriedByServer,
                            hasExploded: true,
                          )
                        : mine,
                ]
              : null,
          heartsByParticipant: event.heartsByParticipant,
          answersLeft: event.answersLeft,
          minesLeftByParticipant: event.minesLeftByParticipant,
        ),
      );
    case MinesScanned() when round is MinesRound:
      final result = event.result;
      return state.copyWith(
        currentRound: () => round.copyWith(
          turnDeadlineAt: event.turnDeadlineAt,
          lastScanResult: result,
          detectorUsesLeft: result != null && round.detectorUsesLeft != null
              ? round.detectorUsesLeft! - 1
              : null,
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

/// A battle known only by its id, for example after an app restart (`GET /v1/me/play-state`).
/// Everything else comes from the first snapshot, so it starts out waiting for one.
BattleState createBattleStateToResume(String battleId) => BattleState(
  battleId: battleId,
  gameType: GameType.unknown,
  isRoomBattle: false,
  players: const [],
  youParticipantId: '',
  publicConfig: const {},
  phase: BattlePhase.inProgress,
  lastSeq: 0,
  needsResync: true,
);

/// Replaces the live part of [state] with a `battle:snapshot` (the `battle:resync` ack).
/// A snapshot does not name the viewer's seat: for a resumed battle, [viewerUserId] finds
/// it among the players. Throws [FormatException] when the snapshot breaks the contract.
BattleState applyBattleSnapshot(
  BattleState state,
  Object? snapshotJson, {
  String? viewerUserId,
}) {
  final snapshot = JsonObjectReader(snapshotJson, 'battle:snapshot');
  final roundJson = snapshot.readOptionalObject('currentRound');
  final scores = readParticipantScores(snapshot.readObjectList('scores'));
  final status = snapshot.readString('status');
  final players = readBattlePlayers(snapshot.readObjectList('players'));
  final firstMover = snapshot.readOptionalObject('firstMover');
  final youParticipantId = state.youParticipantId.isNotEmpty
      ? state.youParticipantId
      : players
                .where((player) => player.userId == viewerUserId)
                .firstOrNull
                ?.participantId ??
            '';

  return BattleState(
    battleId: state.battleId,
    gameType: findGameTypeByCode(snapshot.readString('gameType')),
    isRoomBattle: snapshot.readOptionalString('mode') == 'ROOM',
    players: players,
    youParticipantId: youParticipantId,
    publicConfig: state.publicConfig,
    phase: switch (status) {
      'WAITING_READY' => BattlePhase.waitingReady,
      'PICKING_FIRST' => BattlePhase.pickingFirst,
      'IN_PROGRESS' => BattlePhase.inProgress,
      // The completion details came (or will come) with battle:completed.
      _ =>
        state.phase == BattlePhase.cancelled
            ? BattlePhase.cancelled
            : BattlePhase.completed,
    },
    readyDeadlineAt: state.readyDeadlineAt,
    firstMoverDuel:
        firstMover == null || !firstMover.json.containsKey('attempt')
        ? null
        : _readSnapshotDuel(firstMover),
    firstMoverParticipantId: firstMover?.readOptionalString('participantId'),
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

FirstMoverDuel _readSnapshotDuel(JsonObjectReader duel) => FirstMoverDuel(
  attempt: duel.readInt('attempt'),
  pickDeadlineAt: duel.readOptionalTimestamp('pickDeadlineAt'),
  hasPicked: duel.readBool('youPicked'),
  results: [
    for (final attempt in duel.readObjectList('attempts'))
      RockPaperScissorsAttemptResult(
        attempt: attempt.readInt('attempt'),
        picks: readRockPaperScissorsPicks(attempt.readObjectList('picks')),
        winnerId: attempt.readOptionalString('winnerId'),
      ),
  ],
);

CurrentRound? _readSnapshotRound(
  JsonObjectReader round,
  CurrentRound? previous,
) {
  final roundNo = round.readInt('roundNo');
  if (round.json.containsKey('shown')) return _readSnapshotLineupRound(round);
  if (round.json.containsKey('sides')) return _readSnapshotHexRound(round);
  if (round.json.containsKey('questions')) {
    return _readSnapshotVaultRound(round);
  }
  if (round.json.containsKey('lists')) return _readSnapshotAuctionRound(round);
  if (round.json.containsKey('criteria')) return _readSnapshotMinesRound(round);
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

MinesRound _readSnapshotMinesRound(JsonObjectReader round) {
  final deadlines = round.readOptionalObject('deadlines');
  return MinesRound(
    roundNo: round.readInt('roundNo'),
    criteria: readMinesCriteria(round.readObjectList('criteria')),
    answerCount: round.readInt('answerCount'),
    phase: switch (round.readOptionalString('phase')) {
      'TURNS' => MinesPhase.turns,
      'CLOSED' => MinesPhase.closed,
      _ => MinesPhase.burying,
    },
    buryDeadlineAt: round.readOptionalTimestamp('buryDeadlineAt'),
    yourMines: round.json.containsKey('yourMines')
        ? readMines(round.readObjectList('yourMines'))
        : const [],
    wrongTriesLeft: round.readOptionalInt('wrongTriesLeft'),
    explodedMines: [
      if (round.json.containsKey('exploded'))
        for (final mine in round.readObjectList('exploded'))
          ExplodedMine(
            buriedByParticipantId: mine.readString('buriedBy'),
            player: readEntityRef(mine.readObject('player')),
          ),
    ],
    saidAnswers: [
      if (round.json.containsKey('said'))
        for (final said in round.readObjectList('said'))
          MinesSaidAnswer(
            participantId: said.readString('participantId'),
            outcome: findMinesAnswerOutcomeByCode(said.readString('outcome')),
            player: switch (said.readOptionalObject('player')) {
              final player? => readEntityRef(player),
              null => null,
            },
          ),
    ],
    heartsByParticipant: round.json.containsKey('hearts')
        ? readCountsByParticipant(round.readObjectList('hearts'), 'hearts')
        : const {},
    answersLeft: round.readOptionalInt('answersLeft'),
    minesLeftByParticipant: round.json.containsKey('minesLeft')
        ? readCountsByParticipant(
            round.readObjectList('minesLeft'),
            'minesLeft',
          )
        : const {},
    turnParticipantId: round.readOptionalString('turnOf'),
    turnNo: round.readOptionalInt('turnNo') ?? 0,
    turnDeadlineAt: deadlines?.readOptionalTimestamp('turnDeadlineAt'),
    detectorUsesLeft: round.readOptionalInt('detectorUsesLeft'),
  );
}

AuctionRound _readSnapshotAuctionRound(JsonObjectReader round) {
  final deadlines = round.readOptionalObject('deadlines');
  final deadline = deadlines == null || deadlines.json.isEmpty
      ? null
      : deadlines.readTimestamp(deadlines.json.keys.first);
  return AuctionRound(
    roundNo: round.readInt('roundNo'),
    lists: readAuctionListOffers(round.readObjectList('lists')),
    phase: switch (round.readOptionalString('phase')) {
      'BIDDING' => AuctionPhase.bidding,
      'PROVING' => AuctionPhase.proving,
      'STEALING' => AuctionPhase.stealing,
      'CLOSED' => AuctionPhase.closed,
      _ => AuctionPhase.picking,
    },
    pickerParticipantId: round.readOptionalString('picker') ?? '',
    pickedList: round.readOptionalInt('pickedList'),
    bids: [
      if (round.json.containsKey('bids'))
        for (final bid in round.readObjectList('bids'))
          AuctionBid(
            participantId: bid.readString('participantId'),
            amount: bid.readInt('amount'),
          ),
    ],
    turnParticipantId: round.readOptionalString('turnOf'),
    deadline: deadline,
    proverParticipantId: round.readOptionalString('prover'),
    amount: round.readOptionalInt('amount'),
    isAllIn: round.readOptionalBool('allIn') ?? false,
    maxWrong: round.readOptionalInt('maxWrong'),
    saidNames: [
      if (round.json.containsKey('found'))
        for (final said in round.readObjectList('found'))
          AuctionSaidName(
            player: readEntityRef(said.readObject('player')),
            participantId: said.readString('saidBy'),
          ),
    ],
    strikes: round.readOptionalInt('strikes') ?? 0,
    stealerParticipantId: round.readOptionalString('stealer'),
  );
}

VaultRound _readSnapshotVaultRound(JsonObjectReader round) {
  final tries = round.readOptionalObject('tries');
  return VaultRound(
    roundNo: round.readInt('roundNo'),
    questions: round.readStringList('questions'),
    digits: round.readInt('digits'),
    roundDeadlineAt: round.readTimestamp('roundDeadlineAt'),
    leakedDigits: [
      if (round.json.containsKey('leaked'))
        for (final leak in round.readObjectList('leaked'))
          VaultLeakedDigit(
            position: leak.readInt('position'),
            digit: leak.readInt('digit'),
          ),
    ],
    triesByParticipant: {
      if (tries != null)
        for (final participantId in tries.json.keys)
          participantId.toString(): tries.readInt(participantId.toString()),
    },
    yourLockedUntil: round.readOptionalTimestamp('lockedUntil'),
    nextLeakAt: round.readOptionalTimestamp('nextLeakAt'),
  );
}

HexRound _readSnapshotHexRound(JsonObjectReader round) {
  final lockouts = round.readOptionalObject('lockedUntil');
  final clears = round.readOptionalObject('clearsLeft');
  final sides = round.readOptionalObject('sides');
  final board = round.readStringList('board');
  final owners = round.json['owners'];
  return HexRound(
    roundNo: round.readInt('roundNo'),
    size: round.readInt('size'),
    board: board,
    owners: owners is List
        ? [for (final owner in owners) owner is String ? owner : null]
        : List<String?>.filled(board.length, null),
    sides: sides == null ? const {} : readHexSides(sides),
    phase: switch (round.readOptionalString('phase')) {
      'RACING' => HexPhase.racing,
      'CLOSED' => HexPhase.closed,
      _ => HexPhase.picking,
    },
    turnParticipantId: round.readOptionalString('turnOf') ?? '',
    deadline: round.readTimestamp('deadline'),
    clearsLeft: clears == null ? const {} : readIntMap(clears),
    racingCell: round.readOptionalInt('racingCell'),
    question: round.readOptionalString('question'),
    letter: round.readOptionalString('letter'),
    lockedUntil: {
      if (lockouts != null)
        for (final participantId in lockouts.json.keys)
          participantId.toString(): ?lockouts.readOptionalTimestamp(
            participantId.toString(),
          ),
    },
  );
}

LineupRound _readSnapshotLineupRound(JsonObjectReader round) {
  final fake = round.readOptionalObject('fake');
  return LineupRound(
    roundNo: round.readInt('roundNo'),
    title: round.readString('title'),
    slots: [
      for (final slot in round.readObjectList('slots'))
        switch (slot.readOptionalObject('placed')) {
          final placed? => LineupSlotView(
            spec: readLineupSlots([slot]).single,
            placed: readEntityRef(placed.readObject('player')),
            placedBy: placed.readOptionalString('participantId'),
          ),
          null => LineupSlotView(spec: readLineupSlots([slot]).single),
        },
    ],
    shown: [
      for (final name in round.readObjectList('shown')) readEntityRef(name),
    ],
    roundDeadlineAt: round.readTimestamp('roundDeadlineAt'),
    hintsAt: round.readOptionalTimestamp('hintsAt'),
    letters: round.json.containsKey('hints')
        ? readLineupLetters(round.readObjectList('hints'))
        : const {},
    fake: fake == null ? null : readEntityRef(fake.readObject('player')),
    fakeUnmaskedBy: fake?.readOptionalString('unmaskedBy'),
    yourLockedUntil: round.readOptionalTimestamp('lockedUntil'),
    hasUsedYourAccusation: round.readOptionalBool('accusationUsed') ?? false,
  );
}
