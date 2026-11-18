import 'package:api_client/src/model/auth_tokens_dto.dart';
import 'package:api_client/src/model/competition_dto.dart';
import 'package:api_client/src/model/competition_list_dto.dart';
import 'package:api_client/src/model/connected_user_dto.dart';
import 'package:api_client/src/model/connected_user_page_dto.dart';
import 'package:api_client/src/model/dev_sign_in_dto.dart';
import 'package:api_client/src/model/device_dto.dart';
import 'package:api_client/src/model/friend_prediction_dto.dart';
import 'package:api_client/src/model/friend_prediction_page_dto.dart';
import 'package:api_client/src/model/friend_request_dto.dart';
import 'package:api_client/src/model/friend_request_page_dto.dart';
import 'package:api_client/src/model/google_sign_in_dto.dart';
import 'package:api_client/src/model/identity_dto.dart';
import 'package:api_client/src/model/join_matchmaking_dto.dart';
import 'package:api_client/src/model/leaderboard_page_dto.dart';
import 'package:api_client/src/model/leaderboard_period_dto.dart';
import 'package:api_client/src/model/leaderboard_period_list_dto.dart';
import 'package:api_client/src/model/leaderboard_row_dto.dart';
import 'package:api_client/src/model/match_competition_dto.dart';
import 'package:api_client/src/model/match_detail_dto.dart';
import 'package:api_client/src/model/match_page_dto.dart';
import 'package:api_client/src/model/match_summary_dto.dart';
import 'package:api_client/src/model/matchmaking_ticket_dto.dart';
import 'package:api_client/src/model/me_dto.dart';
import 'package:api_client/src/model/my_rank_dto.dart';
import 'package:api_client/src/model/penalties_dto.dart';
import 'package:api_client/src/model/play_state_battle_dto.dart';
import 'package:api_client/src/model/play_state_dto.dart';
import 'package:api_client/src/model/prediction_dto.dart';
import 'package:api_client/src/model/prediction_pick_dto.dart';
import 'package:api_client/src/model/prediction_score_dto.dart';
import 'package:api_client/src/model/privacy_dto.dart';
import 'package:api_client/src/model/public_user_dto.dart';
import 'package:api_client/src/model/refresh_dto.dart';
import 'package:api_client/src/model/report_question_dto.dart';
import 'package:api_client/src/model/score_dto.dart';
import 'package:api_client/src/model/send_friend_request_dto.dart';
import 'package:api_client/src/model/session_info_dto.dart';
import 'package:api_client/src/model/squad_list_dto.dart';
import 'package:api_client/src/model/squad_player_dto.dart';
import 'package:api_client/src/model/submit_prediction_dto.dart';
import 'package:api_client/src/model/submitted_pick_dto.dart';
import 'package:api_client/src/model/team_dto.dart';
import 'package:api_client/src/model/update_me_dto.dart';
import 'package:api_client/src/model/user_profile_dto.dart';
import 'package:api_client/src/model/user_search_page_dto.dart';
import 'package:api_client/src/model/visible_prediction_dto.dart';
import 'package:api_client/src/model/visible_prediction_page_dto.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

ReturnType deserialize<ReturnType, BaseType>(
  dynamic value,
  String targetType, {
  bool growable = true,
}) {
  switch (targetType) {
    case 'String':
      return '$value' as ReturnType;
    case 'int':
      return (value is int ? value : int.parse('$value')) as ReturnType;
    case 'bool':
      if (value is bool) {
        return value as ReturnType;
      }
      final valueString = '$value'.toLowerCase();
      return (valueString == 'true' || valueString == '1') as ReturnType;
    case 'double':
      return (value is double ? value : double.parse('$value')) as ReturnType;
    case 'AuthTokensDto':
      return AuthTokensDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CompetitionDto':
      return CompetitionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CompetitionListDto':
      return CompetitionListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ConnectedUserDto':
      return ConnectedUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ConnectedUserPageDto':
      return ConnectedUserPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DevSignInDto':
      return DevSignInDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'DeviceDto':
      return DeviceDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'FriendPredictionDto':
      return FriendPredictionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'FriendPredictionPageDto':
      return FriendPredictionPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'FriendRequestDto':
      return FriendRequestDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'FriendRequestPageDto':
      return FriendRequestPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'GoogleSignInDto':
      return GoogleSignInDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'IdentityDto':
      return IdentityDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'JoinMatchmakingDto':
      return JoinMatchmakingDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LeaderboardPageDto':
      return LeaderboardPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LeaderboardPeriodDto':
      return LeaderboardPeriodDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LeaderboardPeriodListDto':
      return LeaderboardPeriodListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LeaderboardRowDto':
      return LeaderboardRowDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MatchCompetitionDto':
      return MatchCompetitionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MatchDetailDto':
      return MatchDetailDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MatchPageDto':
      return MatchPageDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MatchSummaryDto':
      return MatchSummaryDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MatchmakingTicketDto':
      return MatchmakingTicketDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MeDto':
      return MeDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MyRankDto':
      return MyRankDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PenaltiesDto':
      return PenaltiesDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PlayStateBattleDto':
      return PlayStateBattleDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PlayStateDto':
      return PlayStateDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PredictionDto':
      return PredictionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PredictionPickDto':
      return PredictionPickDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PredictionScoreDto':
      return PredictionScoreDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PrivacyDto':
      return PrivacyDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PublicUserDto':
      return PublicUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RefreshDto':
      return RefreshDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ReportQuestionDto':
      return ReportQuestionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ScoreDto':
      return ScoreDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SendFriendRequestDto':
      return SendFriendRequestDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SessionInfoDto':
      return SessionInfoDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SquadListDto':
      return SquadListDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SquadPlayerDto':
      return SquadPlayerDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SubmitPredictionDto':
      return SubmitPredictionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SubmittedPickDto':
      return SubmittedPickDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TeamDto':
      return TeamDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'UpdateMeDto':
      return UpdateMeDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'UserProfileDto':
      return UserProfileDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UserSearchPageDto':
      return UserSearchPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiblePredictionDto':
      return VisiblePredictionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiblePredictionPageDto':
      return VisiblePredictionPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    default:
      RegExpMatch? match;

      if (value is List && (match = _regList.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toList(growable: growable)
            as ReturnType;
      }
      if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toSet()
            as ReturnType;
      }
      if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
        targetType = match![1]!.trim(); // ignore: parameter_assignments
        return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map(
                (dynamic v) => deserialize<BaseType, BaseType>(
                  v,
                  targetType,
                  growable: growable,
                ),
              ),
            )
            as ReturnType;
      }
      break;
  }
  throw Exception('Cannot deserialize');
}
