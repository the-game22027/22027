import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/predictions/data/prediction_models.dart';
import 'package:the_game/features/predictions/data/predictions_repository.dart';

/// The player's prediction for one match (`null` = not predicted yet), and submitting it.
class OwnPredictionController extends AsyncNotifier<Prediction?> {
  OwnPredictionController(this.matchId);

  final String matchId;

  @override
  Future<Prediction?> build() =>
      ref.read(predictionsRepositoryProvider).fetchOwnPrediction(matchId);

  /// Saves the predicted score and returns the stored prediction. The server decides whether
  /// the match is still open: a refusal (`PREDICTION_LOCKED`, `MATCH_NOT_PREDICTABLE`, …) is
  /// thrown as an `ApiProblemError` and the previous prediction stays in [state].
  Future<Prediction> submitExactScore({
    required int homeGoals,
    required int awayGoals,
  }) async {
    if (homeGoals < 0 || awayGoals < 0) {
      throw ArgumentError('goals cannot be negative');
    }
    final prediction = await ref
        .read(predictionsRepositoryProvider)
        .submitPrediction(
          matchId: matchId,
          picks: [ExactScorePick(home: homeGoals, away: awayGoals)],
        );
    if (ref.mounted) state = AsyncData(prediction);
    return prediction;
  }
}

final ownPredictionProvider = AsyncNotifierProvider.autoDispose
    .family<OwnPredictionController, Prediction?, String>(
      OwnPredictionController.new,
    );
