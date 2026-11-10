import 'package:api_client/src/model/auth_tokens_dto.dart';
import 'package:api_client/src/model/competition_dto.dart';
import 'package:api_client/src/model/competition_list_dto.dart';
import 'package:api_client/src/model/dev_sign_in_dto.dart';
import 'package:api_client/src/model/device_dto.dart';
import 'package:api_client/src/model/google_sign_in_dto.dart';
import 'package:api_client/src/model/identity_dto.dart';
import 'package:api_client/src/model/match_competition_dto.dart';
import 'package:api_client/src/model/match_detail_dto.dart';
import 'package:api_client/src/model/match_page_dto.dart';
import 'package:api_client/src/model/match_summary_dto.dart';
import 'package:api_client/src/model/me_dto.dart';
import 'package:api_client/src/model/penalties_dto.dart';
import 'package:api_client/src/model/prediction_dto.dart';
import 'package:api_client/src/model/prediction_pick_dto.dart';
import 'package:api_client/src/model/privacy_dto.dart';
import 'package:api_client/src/model/refresh_dto.dart';
import 'package:api_client/src/model/score_dto.dart';
import 'package:api_client/src/model/session_info_dto.dart';
import 'package:api_client/src/model/squad_list_dto.dart';
import 'package:api_client/src/model/squad_player_dto.dart';
import 'package:api_client/src/model/submit_prediction_dto.dart';
import 'package:api_client/src/model/submitted_pick_dto.dart';
import 'package:api_client/src/model/team_dto.dart';
import 'package:api_client/src/model/update_me_dto.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

  ReturnType deserialize<ReturnType, BaseType>(dynamic value, String targetType, {bool growable= true}) {
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
          return AuthTokensDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'CompetitionDto':
          return CompetitionDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'CompetitionListDto':
          return CompetitionListDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'DevSignInDto':
          return DevSignInDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'DeviceDto':
          return DeviceDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'GoogleSignInDto':
          return GoogleSignInDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'IdentityDto':
          return IdentityDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MatchCompetitionDto':
          return MatchCompetitionDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MatchDetailDto':
          return MatchDetailDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MatchPageDto':
          return MatchPageDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MatchSummaryDto':
          return MatchSummaryDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeDto':
          return MeDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PenaltiesDto':
          return PenaltiesDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PredictionDto':
          return PredictionDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PredictionPickDto':
          return PredictionPickDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PrivacyDto':
          return PrivacyDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'RefreshDto':
          return RefreshDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ScoreDto':
          return ScoreDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SessionInfoDto':
          return SessionInfoDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SquadListDto':
          return SquadListDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SquadPlayerDto':
          return SquadPlayerDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SubmitPredictionDto':
          return SubmitPredictionDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SubmittedPickDto':
          return SubmittedPickDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'TeamDto':
          return TeamDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'UpdateMeDto':
          return UpdateMeDto.fromJson(value as Map<String, dynamic>) as ReturnType;
        default:
          RegExpMatch? match;

          if (value is List && (match = _regList.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toList(growable: growable) as ReturnType;
          }
          if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toSet() as ReturnType;
          }
          if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
            targetType = match![1]!.trim(); // ignore: parameter_assignments
            return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable)),
            ) as ReturnType;
          }
          break;
    }
    throw Exception('Cannot deserialize');
  }