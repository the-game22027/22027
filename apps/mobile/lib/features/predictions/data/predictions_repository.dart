import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/paging/cursor_page.dart';
import 'package:the_game/core/time/parse_server_timestamp.dart';
import 'package:the_game/features/predictions/data/prediction_models.dart';
import 'package:the_game/features/social/data/social_mappers.dart';
import 'package:the_game/features/social/data/social_models.dart';

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

  /// `GET /v1/matches/{matchId}/predictions/friends`: the friends' predictions the server
  /// allows the player to see now. Before kickoff the list is empty; visibility is never
  /// computed on the device.
  Future<CursorPage<FriendPrediction>> fetchFriendsPredictions(
    String matchId, {
    int? limit,
    String? cursor,
  }) async {
    final page = await sendRequestAndReadData(
      () => _predictionsApi.visiblePredictionsControllerFriendsForMatchV1(
        matchId: matchId,
        limit: limit,
        cursor: cursor,
      ),
    );
    return CursorPage(
      items: [
        for (final item in page.items)
          FriendPrediction(
            user: convertPublicUser(item.user),
            picks: [for (final pick in item.picks) _convertPick(pick)],
            status: _convertVisibleStatus(item.status.value),
            points: item.score?.points.toInt(),
          ),
      ],
      nextCursor: page.nextCursor,
    );
  }

  /// `GET /v1/users/{userId}/predictions`: another player's visible predictions.
  /// `404 USER_NOT_FOUND` (as `KnownProblemError<SocialFailureReason>`) when the player is
  /// not a friend, is blocked, or does not exist.
  Future<CursorPage<VisiblePrediction>> fetchPredictionsOfUser(
    String userId, {
    int? limit,
    String? cursor,
  }) async {
    final page = await convertKnownProblems(
      () => sendRequestAndReadData(
        () => _predictionsApi.visiblePredictionsControllerOfUserV1(
          userId: userId,
          limit: limit,
          cursor: cursor,
        ),
      ),
      (problem) => findReasonByCode(problem, socialFailureReasonsByCode),
    );
    return CursorPage(
      items: [
        for (final item in page.items)
          VisiblePrediction(
            matchId: item.matchId,
            picks: [for (final pick in item.picks) _convertPick(pick)],
            status: _convertVisibleStatus(item.status.value),
            updatedAt: parseServerTimestamp(item.updatedAt),
            points: item.score?.points.toInt(),
          ),
      ],
      nextCursor: page.nextCursor,
    );
  }
}

/// Both visible-prediction DTOs have their own status enum with the same wire values.
PredictionStatus _convertVisibleStatus(String status) => switch (status) {
  'ACTIVE' => PredictionStatus.active,
  'VOID' => PredictionStatus.voided,
  _ => PredictionStatus.unknown,
};

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
