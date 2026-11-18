/// The player's own prediction for a match (API §5, "Predictions").
library;

import 'package:the_game/features/social/data/social_models.dart';

enum MatchOutcome { home, draw, away, unknown }

enum PredictionStatus {
  active,

  /// The match was cancelled or abandoned: the prediction no longer counts.
  voided,
  unknown,
}

sealed class PredictionPick {
  const PredictionPick();
}

/// The score the player predicts. The only pick the player submits today.
class ExactScorePick extends PredictionPick {
  const ExactScorePick({required this.home, required this.away});

  final int home;
  final int away;
}

/// Derived by the server from the exact score (DEC-03); never sent by the app.
class ResultPick extends PredictionPick {
  const ResultPick(this.outcome);

  final MatchOutcome outcome;
}

/// A pick type this app version does not know yet.
class UnknownPick extends PredictionPick {
  const UnknownPick(this.type);

  final String type;
}

class Prediction {
  const Prediction({
    required this.id,
    required this.matchId,
    required this.picks,
    required this.revision,
    required this.status,
    required this.updatedAt,
    required this.isLocked,
  });

  final String id;
  final String matchId;
  final List<PredictionPick> picks;

  /// Grows with every change; another device's edit shows up as a higher revision.
  final int revision;
  final PredictionStatus status;
  final DateTime updatedAt;

  /// Kickoff reached (decided by the server): the prediction can no longer change.
  final bool isLocked;

  ExactScorePick? get exactScore =>
      picks.whereType<ExactScorePick>().firstOrNull;
}

/// A prediction of another player that the server chose to show (DEC-21: friends, after
/// kickoff). The app never decides visibility: what is missing was not sent.
class FriendPrediction {
  const FriendPrediction({
    required this.user,
    required this.picks,
    required this.status,
    this.points,
  });

  final PublicUser user;
  final List<PredictionPick> picks;
  final PredictionStatus status;

  /// `null` until the match is scored.
  final int? points;

  ExactScorePick? get exactScore =>
      picks.whereType<ExactScorePick>().firstOrNull;
}

/// One entry of another player's visible predictions (`GET /v1/users/{userId}/predictions`).
class VisiblePrediction {
  const VisiblePrediction({
    required this.matchId,
    required this.picks,
    required this.status,
    required this.updatedAt,
    this.points,
  });

  final String matchId;
  final List<PredictionPick> picks;
  final PredictionStatus status;
  final DateTime updatedAt;
  final int? points;

  ExactScorePick? get exactScore =>
      picks.whereType<ExactScorePick>().firstOrNull;
}
