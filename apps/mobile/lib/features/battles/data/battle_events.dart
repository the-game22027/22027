/// Server → client events of the `/battles` namespace (`WEBSOCKET.md` §2, §4), parsed from
/// their envelope. Screens and the battle state reducer use these, never raw maps.
library;

enum GameType { buzzer, career, whoIsPlayer, grid, mines, auction, unknown }

GameType findGameTypeByCode(String code) => switch (code) {
  'BUZZER' => GameType.buzzer,
  'CAREER' => GameType.career,
  'WHO_IS_PLAYER' => GameType.whoIsPlayer,
  'GRID' => GameType.grid,
  'MINES' => GameType.mines,
  'AUCTION' => GameType.auction,
  _ => GameType.unknown,
};

String convertGameTypeToCode(GameType gameType) => switch (gameType) {
  GameType.buzzer => 'BUZZER',
  GameType.career => 'CAREER',
  GameType.whoIsPlayer => 'WHO_IS_PLAYER',
  GameType.grid => 'GRID',
  GameType.mines => 'MINES',
  GameType.auction => 'AUCTION',
  GameType.unknown => throw ArgumentError('unknown game type has no code'),
};

enum BattlePlayerKind { human, bot, unknown }

class BattlePlayer {
  const BattlePlayer({
    required this.participantId,
    required this.kind,
    required this.seat,
    required this.displayName,
    this.userId,
    this.avatarUrl,
    this.hasForfeited = false,
  });

  /// Stable inside the battle: events name players by it, not by user id.
  final String participantId;
  final BattlePlayerKind kind;
  final int seat;

  /// The human's display name, or the bot's (bots are always labeled, DEC-40).
  final String displayName;
  final String? userId;
  final String? avatarUrl;
  final bool hasForfeited;
}

/// An entity named in the viewer's language, for example a wrong answer or a claimed player.
class EntityRef {
  const EntityRef({required this.entityId, required this.name});

  final String entityId;
  final String name;
}

/// An answer as shown back by the server: an entity, or a number for `NUMBER` rounds.
class ShownAnswer {
  const ShownAnswer({this.entity, this.number});

  final EntityRef? entity;
  final num? number;
}

/// A grid cell; `row` and `col` go from 0 to 2.
class GridCell {
  const GridCell({required this.row, required this.col});

  final int row;
  final int col;

  @override
  bool operator ==(Object other) =>
      other is GridCell && other.row == row && other.col == col;

  @override
  int get hashCode => Object.hash(row, col);
}

enum GridCriterionKind { club, nationality, competitionWon, unknown }

class GridCriterion {
  const GridCriterion({required this.kind, required this.entity});

  final GridCriterionKind kind;
  final EntityRef entity;
}

enum MinesCriterionKind { club, nationality, decade, unknown }

/// Half of a `MINES` category (`08` §10.4): a club, a citizenship, or a decade.
class MinesCriterion {
  const MinesCriterion({required this.kind, this.entity, this.fromYear});

  final MinesCriterionKind kind;

  /// The club or country; `null` for a decade.
  final EntityRef? entity;

  /// The first year of a decade, for example 2000 for the 2000s.
  final int? fromYear;
}

/// One of your mines, or a mine shown when the round ends.
class MineRef {
  const MineRef({
    required this.player,
    required this.wasBuriedByServer,
    this.hasExploded = false,
  });

  final EntityRef player;

  /// The player did not bury in time, so the server picked this mine (`auto`).
  final bool wasBuriedByServer;
  final bool hasExploded;
}

enum MinesAnswerOutcome {
  safe,
  mine,
  wrong,
  repeated,
  ownMine,
  timeout,
  unknown,
}

MinesAnswerOutcome findMinesAnswerOutcomeByCode(String code) => switch (code) {
  'SAFE' => MinesAnswerOutcome.safe,
  'MINE' => MinesAnswerOutcome.mine,
  'WRONG' => MinesAnswerOutcome.wrong,
  'REPEATED' => MinesAnswerOutcome.repeated,
  'OWN_MINE' => MinesAnswerOutcome.ownMine,
  'TIMEOUT' => MinesAnswerOutcome.timeout,
  _ => MinesAnswerOutcome.unknown,
};

enum MineScanResult { mine, clear }

/// One AUCTION list offered at the start of a round (`08` §11): its title in the viewer's language.
class AuctionListOffer {
  const AuctionListOffer({required this.title, required this.answerCount});

  final String title;

  /// How many names the list has (DEC-76: shown).
  final int answerCount;
}

enum AuctionAnswerPhase { proof, steal, unknown }

enum AuctionAnswerOutcome { correct, wrong, repeated, unknown }

enum AuctionProofReason { call, allIn, timeout, unknown }

/// What the round expects: a name of one kind (`PLAYER`, `CLUB`, …), typed as text, or a
/// number. Screens use it for the hint and the keyboard.
class RoundAnswerKind {
  const RoundAnswerKind(this.code);

  final String code;

  bool get expectsNumber => code == 'NUMBER';
}

class ParticipantScore {
  const ParticipantScore({required this.participantId, required this.score});

  final String participantId;
  final int score;
}

class ParticipantPlacement {
  const ParticipantPlacement({
    required this.participantId,
    required this.placement,
    required this.score,
  });

  final String participantId;
  final int placement;
  final int score;
}

enum BattleOutcome { win, loss, draw, unknown }

/// A rock-paper-scissors throw (`08` §9.1).
enum RockPaperScissorsChoice { rock, paper, scissors, unknown }

RockPaperScissorsChoice findRockPaperScissorsChoiceByCode(String code) =>
    switch (code) {
      'ROCK' => RockPaperScissorsChoice.rock,
      'PAPER' => RockPaperScissorsChoice.paper,
      'SCISSORS' => RockPaperScissorsChoice.scissors,
      _ => RockPaperScissorsChoice.unknown,
    };

String findRockPaperScissorsCode(RockPaperScissorsChoice choice) =>
    switch (choice) {
      RockPaperScissorsChoice.rock => 'ROCK',
      RockPaperScissorsChoice.paper => 'PAPER',
      RockPaperScissorsChoice.scissors => 'SCISSORS',
      RockPaperScissorsChoice.unknown => throw ArgumentError(
        'unknown choice has no code',
      ),
    };

class RockPaperScissorsPick {
  const RockPaperScissorsPick({
    required this.participantId,
    required this.choice,
    required this.wasPickedByServer,
  });

  final String participantId;
  final RockPaperScissorsChoice choice;

  /// The player did not pick in time, so the server picked (`auto`).
  final bool wasPickedByServer;
}

/// Base of every event. Battle events carry `battleId` and a per-battle `seq`; matchmaking
/// and session events carry neither.
sealed class BattleServerEvent {
  const BattleServerEvent({required this.serverTime, this.battleId, this.seq});

  final DateTime serverTime;
  final String? battleId;
  final int? seq;
}

class MatchmakingQueued extends BattleServerEvent {
  const MatchmakingQueued({
    required super.serverTime,
    required this.ticketId,
    required this.queuedAt,
    this.gameType,
    this.botFallbackAt,
  });

  final String ticketId;
  final GameType? gameType;
  final DateTime queuedAt;

  /// When a bot takes the free seat; absent when bots are off (DEC-39).
  final DateTime? botFallbackAt;
}

class MatchmakingTimedOut extends BattleServerEvent {
  const MatchmakingTimedOut({required super.serverTime});
}

class BattleFound extends BattleServerEvent {
  const BattleFound({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.gameType,
    required this.isRoomBattle,
    required this.players,
    required this.youParticipantId,
    required this.publicConfig,
    required this.readyDeadlineAt,
  });

  final GameType gameType;
  final bool isRoomBattle;
  final List<BattlePlayer> players;
  final String youParticipantId;

  /// The game type's public rules (round count, timers); values stay open (DEC-31..44).
  final Map<String, Object?> publicConfig;
  final DateTime readyDeadlineAt;
}

class BattleCancelled extends BattleServerEvent {
  const BattleCancelled({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.reason,
  });

  /// `READY_TIMEOUT`, `PLAYER_LEFT` or `SERVER`.
  final String reason;
}

class BattleStarted extends BattleServerEvent {
  const BattleStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.startedAt,
    required this.players,
  });

  final DateTime startedAt;
  final List<BattlePlayer> players;
}

/// `battle:rps-start`: a new rock-paper-scissors attempt decides who moves first (`08` §9.1).
class RockPaperScissorsStarted extends BattleServerEvent {
  const RockPaperScissorsStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.attempt,
    required this.pickDeadlineAt,
  });

  final int attempt;
  final DateTime pickDeadlineAt;
}

/// `battle:rps-result`: both throws of one attempt, revealed together.
class RockPaperScissorsResult extends BattleServerEvent {
  const RockPaperScissorsResult({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.attempt,
    required this.picks,
    this.winnerId,
    this.decidedBy,
  });

  final int attempt;
  final List<RockPaperScissorsPick> picks;

  /// Null for a tie: another attempt follows.
  final String? winnerId;

  /// `RPS`, or `DRAW` when every attempt was a tie and the server drew the winner.
  final String? decidedBy;
}

/// `round:start` of a reveal-and-buzz game (`BUZZER`, `CAREER`, `WHO_IS_PLAYER`).
class RevealRoundStarted extends BattleServerEvent {
  const RevealRoundStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.answerKind,
    required this.stepCount,
  });

  final int roundNo;
  final RoundAnswerKind answerKind;
  final int stepCount;
}

/// `round:start` of a `GRID` round.
class GridRoundStarted extends BattleServerEvent {
  const GridRoundStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.rows,
    required this.cols,
    required this.firstTurnParticipantId,
  });

  final int roundNo;
  final List<GridCriterion> rows;
  final List<GridCriterion> cols;
  final String firstTurnParticipantId;
}

/// `round:start` of a `MINES` round: the burying phase begins (`08` §10.1).
class MinesRoundStarted extends BattleServerEvent {
  const MinesRoundStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.criteria,
    required this.answerCount,
    required this.minesPerPlayer,
    required this.hearts,
    required this.buryDeadlineAt,
    required this.firstTurnParticipantId,
  });

  final int roundNo;
  final List<MinesCriterion> criteria;

  /// How many players fit the category, mines included.
  final int answerCount;
  final int minesPerPlayer;

  /// Hearts each player starts the round with.
  final int hearts;
  final DateTime buryDeadlineAt;
  final String firstTurnParticipantId;
}

/// `mines:turn`. The first one (`turnNo` 1) ends burying and carries your own final mines.
class MinesTurnStarted extends BattleServerEvent {
  const MinesTurnStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.turnNo,
    required this.turnDeadlineAt,
    this.yourMines,
  });

  final int roundNo;
  final String participantId;
  final int turnNo;
  final DateTime turnDeadlineAt;
  final List<MineRef>? yourMines;
}

/// `mines:answered`: a judged answer or a timeout, with the public counts after it.
class MinesAnswered extends BattleServerEvent {
  const MinesAnswered({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.outcome,
    required this.heartsByParticipant,
    required this.answersLeft,
    required this.minesLeftByParticipant,
    this.player,
    this.buriedByParticipantId,
  });

  final int roundNo;
  final String participantId;
  final MinesAnswerOutcome outcome;

  /// Missing for a timeout, for your own mine, and for a wrong name when wrong answers are hidden.
  final EntityRef? player;

  /// Who buried the mine, for [MinesAnswerOutcome.mine].
  final String? buriedByParticipantId;
  final Map<String, int> heartsByParticipant;

  /// Unsaid players of the category, mines included.
  final int answersLeft;
  final Map<String, int> minesLeftByParticipant;
}

/// `mines:scanned`: someone used the detector. [result] is set only in the scanner's copy.
class MinesScanned extends BattleServerEvent {
  const MinesScanned({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.turnDeadlineAt,
    this.result,
  });

  final int roundNo;
  final String participantId;
  final DateTime turnDeadlineAt;
  final MineScanResult? result;
}

/// `round:start` of an `AUCTION` round: three lists to pick from (`08` §11.1).
class AuctionRoundStarted extends BattleServerEvent {
  const AuctionRoundStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.lists,
    required this.pickerParticipantId,
    required this.pickDeadlineAt,
  });

  final int roundNo;
  final List<AuctionListOffer> lists;
  final String pickerParticipantId;
  final DateTime pickDeadlineAt;
}

/// `auction:picked`: the list this round plays.
class AuctionListPicked extends BattleServerEvent {
  const AuctionListPicked({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.list,
    required this.title,
    required this.answerCount,
    required this.wasPickedByServer,
  });

  final int roundNo;

  /// 0, 1 or 2: the index in [AuctionRoundStarted.lists].
  final int list;
  final String title;
  final int answerCount;

  /// The picker ran out of time, so the server picked (`auto`).
  final bool wasPickedByServer;
}

/// `auction:turn`: whose bidding turn it is.
class AuctionTurnStarted extends BattleServerEvent {
  const AuctionTurnStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.turnDeadlineAt,
    this.currentBid,
    this.currentBidderId,
  });

  final int roundNo;
  final String participantId;
  final DateTime turnDeadlineAt;

  /// `null` before the opening bid.
  final int? currentBid;
  final String? currentBidderId;
}

/// `auction:bid`.
class AuctionBidPlaced extends BattleServerEvent {
  const AuctionBidPlaced({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.amount,
    required this.isAllIn,
  });

  final int roundNo;
  final String participantId;
  final int amount;

  /// A bid of the whole list ("كله يا عم"): the proof starts at once.
  final bool isAllIn;
}

/// `auction:proof`: the last bidder must now type that many names.
class AuctionProofStarted extends BattleServerEvent {
  const AuctionProofStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.proverParticipantId,
    required this.amount,
    required this.maxWrong,
    required this.proofDeadlineAt,
    required this.reason,
  });

  final int roundNo;
  final String proverParticipantId;
  final int amount;

  /// Wrong or repeated names allowed before a bust.
  final int maxWrong;
  final DateTime proofDeadlineAt;
  final AuctionProofReason reason;
}

/// `auction:answered`: a judged name during the proof or the steal.
class AuctionAnswered extends BattleServerEvent {
  const AuctionAnswered({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.phase,
    required this.outcome,
    required this.found,
    required this.strikes,
    this.player,
  });

  final int roundNo;
  final String participantId;
  final AuctionAnswerPhase phase;
  final AuctionAnswerOutcome outcome;

  /// Missing for a wrong name when wrong answers are hidden.
  final EntityRef? player;

  /// Right names so far in this phase (the proof, or the steal).
  final int found;
  final int strikes;
}

/// `auction:steal`: the prover busted; the other player may steal the round.
class AuctionStealStarted extends BattleServerEvent {
  const AuctionStealStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.stealerParticipantId,
    required this.names,
    required this.stealDeadlineAt,
  });

  final int roundNo;
  final String stealerParticipantId;

  /// How many unsaid names the steal needs (DEC-76: 1).
  final int names;
  final DateTime stealDeadlineAt;
}

class ClueRevealed extends BattleServerEvent {
  const ClueRevealed({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.index,
    required this.clue,
    this.nextClueAt,
  });

  final int roundNo;

  /// 1-based step number.
  final int index;
  final String clue;

  /// For animations only; `null` after the last step (final window).
  final DateTime? nextClueAt;
}

class RoundBuzzed extends BattleServerEvent {
  const RoundBuzzed({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.answerDeadlineAt,
  });

  final int roundNo;
  final String participantId;
  final DateTime answerDeadlineAt;
}

class WrongAnswerGiven extends BattleServerEvent {
  const WrongAnswerGiven({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.hasTimedOut,
    this.answer,
  });

  final int roundNo;
  final String participantId;

  /// Present only when wrong answers are shown (DEC-60).
  final ShownAnswer? answer;
  final bool hasTimedOut;
}

class RevealResumed extends BattleServerEvent {
  const RevealResumed({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    this.nextClueAt,
  });

  final int roundNo;
  final DateTime? nextClueAt;
}

class GridTurnStarted extends BattleServerEvent {
  const GridTurnStarted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.turnDeadlineAt,
    required this.attemptsLeft,
  });

  final int roundNo;
  final String participantId;
  final DateTime turnDeadlineAt;
  final int attemptsLeft;
}

class GridCellClaimed extends BattleServerEvent {
  const GridCellClaimed({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.cell,
    required this.participantId,
    required this.player,
  });

  final int roundNo;
  final GridCell cell;
  final String participantId;
  final EntityRef player;
}

class GridTurnMissed extends BattleServerEvent {
  const GridTurnMissed({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.participantId,
    required this.hasTimedOut,
    required this.wasSkipped,
    this.cell,
    this.answer,
  });

  final int roundNo;
  final GridCell? cell;
  final String participantId;
  final EntityRef? answer;
  final bool hasTimedOut;
  final bool wasSkipped;
}

class RoundEnded extends BattleServerEvent {
  const RoundEnded({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.roundNo,
    required this.winnerParticipantIds,
    required this.reveal,
    required this.pointsByParticipant,
    required this.scores,
  });

  final int roundNo;

  /// Empty when nobody won (or a grid draw).
  final List<String> winnerParticipantIds;

  /// The round's solution, shaped by game type (`WEBSOCKET.md` §4.3); kept as JSON until a
  /// screen needs a typed form.
  final Map<String, Object?> reveal;
  final Map<String, int> pointsByParticipant;
  final List<ParticipantScore> scores;
}

class PlayerDisconnected extends BattleServerEvent {
  const PlayerDisconnected({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.participantId,
    required this.graceUntil,
  });

  final String participantId;
  final DateTime graceUntil;
}

class PlayerReconnected extends BattleServerEvent {
  const PlayerReconnected({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.participantId,
  });

  final String participantId;
}

class PlayerForfeited extends BattleServerEvent {
  const PlayerForfeited({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.participantId,
    required this.reason,
  });

  final String participantId;

  /// `GRACE_EXPIRED`, `FORFEIT` or `NOT_READY`.
  final String reason;
}

class BattleCompleted extends BattleServerEvent {
  const BattleCompleted({
    required super.serverTime,
    required super.battleId,
    required super.seq,
    required this.endReason,
    required this.placements,
    required this.arePointsPending,
    this.yourPlacement,
    this.yourOutcome,
    this.yourScore,
  });

  /// `COMPLETED`, `FORFEIT` or `ABANDONED` (no placements).
  final String endReason;
  final int? yourPlacement;
  final BattleOutcome? yourOutcome;
  final int? yourScore;
  final List<ParticipantPlacement> placements;

  /// Ledger points arrive later; false when this mode earns none (DEC-41).
  final bool arePointsPending;
}

/// `error`: a protocol problem not tied to an ack, for example `NO_CONTENT`.
class BattleServerError extends BattleServerEvent {
  const BattleServerError({
    required super.serverTime,
    required this.code,
    required this.message,
  });

  final String code;
  final String message;
}

/// An event this app version does not know: ignored, not fatal.
class UnknownBattleEvent extends BattleServerEvent {
  const UnknownBattleEvent({
    required super.serverTime,
    required this.type,
    super.battleId,
    super.seq,
  });

  final String type;
}

/// Parses one server event. [eventName] is the Socket.IO event; the envelope repeats it in
/// `type`. Throws [FormatException] when a known event breaks the contract.
BattleServerEvent parseBattleServerEvent(String eventName, Object? payload) {
  final envelope = JsonObjectReader(payload, eventName);
  final serverTime = envelope.readTimestamp('serverTime');
  final data = envelope.readObject('data');

  switch (eventName) {
    case 'matchmaking:queued':
      return MatchmakingQueued(
        serverTime: serverTime,
        ticketId: data.readString('ticketId'),
        gameType: switch (data.readOptionalString('gameType')) {
          final code? => findGameTypeByCode(code),
          null => null,
        },
        queuedAt: data.readTimestamp('queuedAt'),
        botFallbackAt: data.readOptionalTimestamp('botFallbackAt'),
      );
    case 'matchmaking:timeout':
      return MatchmakingTimedOut(serverTime: serverTime);
    case 'error':
      return BattleServerError(
        serverTime: serverTime,
        code: data.readString('code'),
        message: data.readOptionalString('message') ?? '',
      );
  }

  // Every other event belongs to a battle.
  final id = envelope.readString('battleId');
  final sequence = envelope.readInt('seq');
  switch (eventName) {
    case 'battle:found':
      return BattleFound(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        gameType: findGameTypeByCode(data.readString('gameType')),
        isRoomBattle: data.readOptionalString('mode') == 'ROOM',
        players: _readPlayers(data),
        youParticipantId: data.readString('youParticipantId'),
        publicConfig: data.readObject('config').json,
        readyDeadlineAt: data.readTimestamp('readyDeadlineAt'),
      );
    case 'battle:cancelled':
      return BattleCancelled(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        reason: data.readString('reason'),
      );
    case 'battle:started':
      return BattleStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        startedAt: data.readTimestamp('startedAt'),
        players: _readPlayers(data),
      );
    case 'battle:rps-start':
      return RockPaperScissorsStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        attempt: data.readInt('attempt'),
        pickDeadlineAt: data.readTimestamp('pickDeadlineAt'),
      );
    case 'battle:rps-result':
      return RockPaperScissorsResult(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        attempt: data.readInt('attempt'),
        picks: readRockPaperScissorsPicks(data.readObjectList('picks')),
        winnerId: data.readOptionalString('winnerId'),
        decidedBy: data.readOptionalString('decidedBy'),
      );
    case 'round:start':
      if (data.json.containsKey('lists')) {
        return AuctionRoundStarted(
          serverTime: serverTime,
          battleId: id,
          seq: sequence,
          roundNo: data.readInt('roundNo'),
          lists: readAuctionListOffers(data.readObjectList('lists')),
          pickerParticipantId: data.readString('pickerParticipantId'),
          pickDeadlineAt: data.readTimestamp('pickDeadlineAt'),
        );
      }
      if (data.json.containsKey('criteria')) {
        return MinesRoundStarted(
          serverTime: serverTime,
          battleId: id,
          seq: sequence,
          roundNo: data.readInt('roundNo'),
          criteria: readMinesCriteria(data.readObjectList('criteria')),
          answerCount: data.readInt('answerCount'),
          minesPerPlayer: data.readInt('minesPerPlayer'),
          hearts: data.readInt('hearts'),
          buryDeadlineAt: data.readTimestamp('buryDeadlineAt'),
          firstTurnParticipantId: data.readString('firstTurnParticipantId'),
        );
      }
      if (data.json.containsKey('rows')) {
        return GridRoundStarted(
          serverTime: serverTime,
          battleId: id,
          seq: sequence,
          roundNo: data.readInt('roundNo'),
          rows: readGridCriteria(data.readObjectList('rows')),
          cols: readGridCriteria(data.readObjectList('cols')),
          firstTurnParticipantId: data.readString('firstTurnParticipantId'),
        );
      }
      return RevealRoundStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        answerKind: RoundAnswerKind(data.readString('answerKind')),
        stepCount: data.readInt('stepCount'),
      );
    case 'round:clue':
      return ClueRevealed(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        index: data.readInt('index'),
        clue: data.readString('clue'),
        nextClueAt: data.readOptionalTimestamp('nextClueAt'),
      );
    case 'round:buzzed':
      return RoundBuzzed(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        answerDeadlineAt: data.readTimestamp('answerDeadlineAt'),
      );
    case 'round:wrong':
      return WrongAnswerGiven(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        answer: _readShownAnswer(data.readOptionalObject('answer')),
        hasTimedOut: data.readBool('timedOut'),
      );
    case 'round:resumed':
      return RevealResumed(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        nextClueAt: data.readOptionalTimestamp('nextClueAt'),
      );
    case 'grid:turn':
      return GridTurnStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        turnDeadlineAt: data.readTimestamp('turnDeadlineAt'),
        attemptsLeft: data.readInt('attemptsLeft'),
      );
    case 'grid:claimed':
      return GridCellClaimed(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        cell: _readCell(data.readObject('cell')),
        participantId: data.readString('participantId'),
        player: _readEntityRef(data.readObject('player')),
      );
    case 'grid:missed':
      final cell = data.readOptionalObject('cell');
      final answer = data.readOptionalObject('answer');
      return GridTurnMissed(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        cell: cell == null ? null : _readCell(cell),
        participantId: data.readString('participantId'),
        answer: answer == null ? null : _readEntityRef(answer),
        hasTimedOut: data.readBool('timedOut'),
        wasSkipped: data.readBool('skipped'),
      );
    case 'auction:picked':
      return AuctionListPicked(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        list: data.readInt('list'),
        title: data.readString('title'),
        answerCount: data.readInt('answerCount'),
        wasPickedByServer: data.readBool('auto'),
      );
    case 'auction:turn':
      return AuctionTurnStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        turnDeadlineAt: data.readTimestamp('turnDeadlineAt'),
        currentBid: data.readOptionalInt('currentBid'),
        currentBidderId: data.readOptionalString('currentBidderId'),
      );
    case 'auction:bid':
      return AuctionBidPlaced(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        amount: data.readInt('amount'),
        isAllIn: data.readBool('allIn'),
      );
    case 'auction:proof':
      return AuctionProofStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        proverParticipantId: data.readString('proverParticipantId'),
        amount: data.readInt('amount'),
        maxWrong: data.readInt('maxWrong'),
        proofDeadlineAt: data.readTimestamp('proofDeadlineAt'),
        reason: switch (data.readString('reason')) {
          'CALL' => AuctionProofReason.call,
          'ALL_IN' => AuctionProofReason.allIn,
          'TIMEOUT' => AuctionProofReason.timeout,
          _ => AuctionProofReason.unknown,
        },
      );
    case 'auction:answered':
      final answeredPlayer = data.readOptionalObject('player');
      return AuctionAnswered(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        phase: switch (data.readString('phase')) {
          'PROOF' => AuctionAnswerPhase.proof,
          'STEAL' => AuctionAnswerPhase.steal,
          _ => AuctionAnswerPhase.unknown,
        },
        outcome: switch (data.readString('outcome')) {
          'CORRECT' => AuctionAnswerOutcome.correct,
          'WRONG' => AuctionAnswerOutcome.wrong,
          'REPEATED' => AuctionAnswerOutcome.repeated,
          _ => AuctionAnswerOutcome.unknown,
        },
        player: answeredPlayer == null ? null : _readEntityRef(answeredPlayer),
        found: data.readInt('found'),
        strikes: data.readInt('strikes'),
      );
    case 'auction:steal':
      return AuctionStealStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        stealerParticipantId: data.readString('stealerParticipantId'),
        names: data.readInt('names'),
        stealDeadlineAt: data.readTimestamp('stealDeadlineAt'),
      );
    case 'mines:turn':
      return MinesTurnStarted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        turnNo: data.readInt('turnNo'),
        turnDeadlineAt: data.readTimestamp('turnDeadlineAt'),
        yourMines: data.json.containsKey('yourMines')
            ? readMines(data.readObjectList('yourMines'))
            : null,
      );
    case 'mines:answered':
      final player = data.readOptionalObject('player');
      return MinesAnswered(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        outcome: findMinesAnswerOutcomeByCode(data.readString('outcome')),
        player: player == null ? null : _readEntityRef(player),
        buriedByParticipantId: data.readOptionalString('buriedBy'),
        heartsByParticipant: readCountsByParticipant(
          data.readObjectList('hearts'),
          'hearts',
        ),
        answersLeft: data.readInt('answersLeft'),
        minesLeftByParticipant: readCountsByParticipant(
          data.readObjectList('minesLeft'),
          'minesLeft',
        ),
      );
    case 'mines:scanned':
      return MinesScanned(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        participantId: data.readString('participantId'),
        turnDeadlineAt: data.readTimestamp('turnDeadlineAt'),
        result: switch (data.readOptionalString('result')) {
          'MINE' => MineScanResult.mine,
          'CLEAR' => MineScanResult.clear,
          _ => null,
        },
      );
    case 'round:result':
      return RoundEnded(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        roundNo: data.readInt('roundNo'),
        winnerParticipantIds: data.readStringList('winnerParticipantIds'),
        reveal: data.readObject('reveal').json,
        pointsByParticipant: {
          for (final points in data.readObjectList('points'))
            points.readString('participantId'): points.readInt('points'),
        },
        scores: readParticipantScores(data.readObjectList('scores')),
      );
    case 'player:disconnected':
      return PlayerDisconnected(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        participantId: data.readString('participantId'),
        graceUntil: data.readTimestamp('graceUntil'),
      );
    case 'player:reconnected':
      return PlayerReconnected(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        participantId: data.readString('participantId'),
      );
    case 'player:forfeited':
      return PlayerForfeited(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        participantId: data.readString('participantId'),
        reason: data.readString('reason'),
      );
    case 'battle:completed':
      final you = data.readOptionalObject('you');
      return BattleCompleted(
        serverTime: serverTime,
        battleId: id,
        seq: sequence,
        endReason: data.readString('endReason'),
        yourPlacement: you?.readOptionalInt('placement'),
        yourOutcome: switch (you?.readOptionalString('outcome')) {
          'WIN' => BattleOutcome.win,
          'LOSS' => BattleOutcome.loss,
          'DRAW' => BattleOutcome.draw,
          null => null,
          _ => BattleOutcome.unknown,
        },
        yourScore: you?.readOptionalInt('score'),
        placements: [
          for (final placement in data.readObjectList('placements'))
            ParticipantPlacement(
              participantId: placement.readString('participantId'),
              placement: placement.readInt('placement'),
              score: placement.readInt('score'),
            ),
        ],
        arePointsPending: data.readBool('pointsPending'),
      );
    default:
      return UnknownBattleEvent(
        serverTime: serverTime,
        type: eventName,
        battleId: id,
        seq: sequence,
      );
  }
}

List<RockPaperScissorsPick> readRockPaperScissorsPicks(
  List<JsonObjectReader> picks,
) => [
  for (final pick in picks)
    RockPaperScissorsPick(
      participantId: pick.readString('participantId'),
      choice: findRockPaperScissorsChoiceByCode(pick.readString('choice')),
      wasPickedByServer: pick.readBool('auto'),
    ),
];

List<ParticipantScore> readParticipantScores(List<JsonObjectReader> scores) => [
  for (final score in scores)
    ParticipantScore(
      participantId: score.readString('participantId'),
      score: score.readInt('score'),
    ),
];

List<BattlePlayer> readBattlePlayers(List<JsonObjectReader> players) => [
  for (final player in players)
    () {
      final user = player.readOptionalObject('user');
      final bot = player.readOptionalObject('bot');
      return BattlePlayer(
        participantId: player.readString('participantId'),
        kind: switch (player.readString('kind')) {
          'HUMAN' => BattlePlayerKind.human,
          'BOT' => BattlePlayerKind.bot,
          _ => BattlePlayerKind.unknown,
        },
        seat: player.readInt('seat'),
        displayName:
            user?.readString('displayName') ??
            bot?.readString('displayName') ??
            '',
        userId: user?.readString('id'),
        avatarUrl:
            user?.readOptionalString('avatarUrl') ??
            bot?.readOptionalString('avatarUrl'),
        hasForfeited: player.readOptionalBool('forfeited') ?? false,
      );
    }(),
];

List<BattlePlayer> _readPlayers(JsonObjectReader data) =>
    readBattlePlayers(data.readObjectList('players'));

List<GridCriterion> readGridCriteria(List<JsonObjectReader> criteria) => [
  for (final criterion in criteria)
    GridCriterion(
      kind: switch (criterion.readString('kind')) {
        'CLUB' => GridCriterionKind.club,
        'NATIONALITY' => GridCriterionKind.nationality,
        'COMPETITION_WON' => GridCriterionKind.competitionWon,
        _ => GridCriterionKind.unknown,
      },
      entity: _readEntityRef(criterion.readObject('entity')),
    ),
];

List<AuctionListOffer> readAuctionListOffers(List<JsonObjectReader> lists) => [
  for (final list in lists)
    AuctionListOffer(
      title: list.readString('title'),
      answerCount: list.readInt('answerCount'),
    ),
];

List<MinesCriterion> readMinesCriteria(List<JsonObjectReader> criteria) => [
  for (final criterion in criteria)
    MinesCriterion(
      kind: switch (criterion.readString('kind')) {
        'CLUB' => MinesCriterionKind.club,
        'NATIONALITY' => MinesCriterionKind.nationality,
        'DECADE' => MinesCriterionKind.decade,
        _ => MinesCriterionKind.unknown,
      },
      entity: switch (criterion.readOptionalObject('entity')) {
        final entity? => _readEntityRef(entity),
        null => null,
      },
      fromYear: criterion.readOptionalInt('fromYear'),
    ),
];

/// Mines as the server sends them in acks, events and snapshots (`exploded` may be missing).
List<MineRef> readMines(List<JsonObjectReader> mines) => [
  for (final mine in mines)
    MineRef(
      player: _readEntityRef(mine.readObject('player')),
      wasBuriedByServer: mine.readBool('auto'),
      hasExploded: mine.readOptionalBool('exploded') ?? false,
    ),
];

/// `[{ participantId, <field> }]` → participant id → count.
Map<String, int> readCountsByParticipant(
  List<JsonObjectReader> counts,
  String field,
) => {
  for (final count in counts)
    count.readString('participantId'): count.readInt(field),
};

EntityRef readEntityRef(JsonObjectReader entity) => _readEntityRef(entity);

GridCell readGridCell(JsonObjectReader cell) => _readCell(cell);

GridCell _readCell(JsonObjectReader cell) =>
    GridCell(row: cell.readInt('row'), col: cell.readInt('col'));

EntityRef _readEntityRef(JsonObjectReader entity) => EntityRef(
  entityId: entity.readString('entityId'),
  name: entity.readString('name'),
);

ShownAnswer? _readShownAnswer(JsonObjectReader? answer) {
  if (answer == null) return null;
  if (answer.json.containsKey('number')) {
    return ShownAnswer(number: answer.readNumber('number'));
  }
  return ShownAnswer(entity: _readEntityRef(answer));
}

/// Reads typed fields from a decoded JSON object and names the event and field in every
/// [FormatException], so a contract break is easy to find in logs.
class JsonObjectReader {
  JsonObjectReader(Object? value, this.context)
    : json = value is Map
          ? value.cast<String, Object?>()
          : throw FormatException('$context: expected a JSON object');

  final Map<String, Object?> json;
  final String context;

  T _read<T>(String key) {
    final value = json[key];
    if (value is T) return value;
    throw FormatException('$context: "$key" should be $T, got $value');
  }

  T? _readOptional<T>(String key) {
    final value = json[key];
    if (value == null || value is T) return value as T?;
    throw FormatException('$context: "$key" should be $T, got $value');
  }

  String readString(String key) => _read<String>(key);
  String? readOptionalString(String key) => _readOptional<String>(key);
  int readInt(String key) => _read<num>(key).toInt();
  int? readOptionalInt(String key) => _readOptional<num>(key)?.toInt();
  num readNumber(String key) => _read<num>(key);
  bool readBool(String key) => _read<bool>(key);
  bool? readOptionalBool(String key) => _readOptional<bool>(key);

  DateTime readTimestamp(String key) {
    final timestamp = DateTime.tryParse(readString(key));
    if (timestamp == null) {
      throw FormatException('$context: "$key" is not a timestamp');
    }
    return timestamp.toUtc();
  }

  DateTime? readOptionalTimestamp(String key) =>
      json[key] == null ? null : readTimestamp(key);

  JsonObjectReader readObject(String key) =>
      JsonObjectReader(json[key], '$context.$key');

  JsonObjectReader? readOptionalObject(String key) =>
      json[key] == null ? null : readObject(key);

  List<JsonObjectReader> readObjectList(String key) => [
    for (final (index, item) in _read<List<Object?>>(key).indexed)
      JsonObjectReader(item, '$context.$key[$index]'),
  ];

  List<String> readStringList(String key) =>
      _read<List<Object?>>(key).cast<String>();
}
