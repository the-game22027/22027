import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/time/parse_server_timestamp.dart';
import 'package:the_game/features/predictions/data/prediction_models.dart';

/// The player's own predictions (API §6.4).
class PredictionsRepository {
  PredictionsRepository(this._predictionsApi);

  final PredictionsApi _predictionsApi;

  /// `GET /v1/matches/{matchId}/prediction`. `null` when the player has not predicted yet
  /// (the API answers `404`).
  Future<Prediction?> fetchOwnPrediction(String matchId) async {
    try {
      return _convertPrediction(
        await sendRequestAndReadData(
          () => _predictionsApi.predictionsControllerGetOwnV1(matchId: matchId),
        ),
      );
    } on ApiProblemError catch (error) {
      if (error.problem.status == 404) return null;
      rethrow;
    }
  }

  /// `PUT /v1/matches/{matchId}/prediction`: creates or replaces the prediction. The server
  /// enforces the kickoff lock: `409 PREDICTION_LOCKED`, `409 MATCH_NOT_PREDICTABLE`,
  /// `422 PREDICTION_INVALID_PICKS`.
  Future<Prediction> submitPrediction({
    required String matchId,
    required List<ExactScorePick> picks,
  }) async => _convertPrediction(
    await sendRequestAndReadData(
      () => _predictionsApi.predictionsControllerSubmitV1(
        matchId: matchId,
        submitPredictionDto: SubmitPredictionDto(
          picks: [
            for (final pick in picks)
              SubmittedPickDto(
                type: 'EXACT_SCORE',
                home: pick.home,
                away: pick.away,
              ),
          ],
        ),
      ),
    ),
  );
}

Prediction _convertPrediction(PredictionDto prediction) => Prediction(
  id: prediction.id,
  matchId: prediction.matchId,
  picks: [for (final pick in prediction.picks) _convertPick(pick)],
  revision: prediction.revision.toInt(),
  status: switch (prediction.status) {
    PredictionDtoStatusEnum.ACTIVE => PredictionStatus.active,
    PredictionDtoStatusEnum.VOID => PredictionStatus.voided,
    PredictionDtoStatusEnum.unknownDefaultOpenApi => PredictionStatus.unknown,
  },
  updatedAt: parseServerTimestamp(prediction.updatedAt),
  isLocked: prediction.locked,
);

PredictionPick _convertPick(PredictionPickDto pick) {
  final home = pick.home;
  final away = pick.away;
  return switch (pick.type) {
    PredictionPickDtoTypeEnum.EXACT_SCORE when home != null && away != null =>
      ExactScorePick(home: home.toInt(), away: away.toInt()),
    PredictionPickDtoTypeEnum.RESULT => ResultPick(switch (pick.outcome) {
      PredictionPickDtoOutcomeEnum.HOME => MatchOutcome.home,
      PredictionPickDtoOutcomeEnum.DRAW => MatchOutcome.draw,
      PredictionPickDtoOutcomeEnum.AWAY => MatchOutcome.away,
      PredictionPickDtoOutcomeEnum.unknownDefaultOpenApi ||
      null => MatchOutcome.unknown,
    }),
    _ => UnknownPick(pick.type.value),
  };
}

final predictionsRepositoryProvider = Provider<PredictionsRepository>(
  (ref) =>
      PredictionsRepository(ref.watch(apiClientProvider).getPredictionsApi()),
);
