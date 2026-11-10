//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/match_competition_dto.dart';
import 'package:api_client/src/model/score_dto.dart';
import 'package:api_client/src/model/team_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'match_detail_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MatchDetailDto {
  /// Returns a new [MatchDetailDto] instance.
  MatchDetailDto({

    required  this.awayTeam,

    required  this.competition,

    required  this.endedAt,

    required  this.homeTeam,

    required  this.id,

    required  this.kickoffAt,

    required  this.predictable,

    required  this.roundLabel,

    required  this.score,

    required  this.serverTime,

    required  this.status,
  });

  @JsonKey(
    
    name: r'awayTeam',
    required: true,
    includeIfNull: false,
  )


  final TeamDto awayTeam;



  @JsonKey(
    
    name: r'competition',
    required: true,
    includeIfNull: false,
  )


  final MatchCompetitionDto competition;



  @JsonKey(
    
    name: r'endedAt',
    required: true,
    includeIfNull: true,
  )


  final String? endedAt;



  @JsonKey(
    
    name: r'homeTeam',
    required: true,
    includeIfNull: false,
  )


  final TeamDto homeTeam;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'kickoffAt',
    required: true,
    includeIfNull: false,
  )


  final String kickoffAt;



  @JsonKey(
    
    name: r'predictable',
    required: true,
    includeIfNull: false,
  )


  final bool predictable;



  @JsonKey(
    
    name: r'roundLabel',
    required: true,
    includeIfNull: true,
  )


  final String? roundLabel;



  @JsonKey(
    
    name: r'score',
    required: true,
    includeIfNull: true,
  )


  final ScoreDto? score;



  @JsonKey(
    
    name: r'serverTime',
    required: true,
    includeIfNull: false,
  )


  final String serverTime;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: MatchDetailDtoStatusEnum.unknownDefaultOpenApi,
  )


  final MatchDetailDtoStatusEnum status;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MatchDetailDto &&
      other.awayTeam == awayTeam &&
      other.competition == competition &&
      other.endedAt == endedAt &&
      other.homeTeam == homeTeam &&
      other.id == id &&
      other.kickoffAt == kickoffAt &&
      other.predictable == predictable &&
      other.roundLabel == roundLabel &&
      other.score == score &&
      other.serverTime == serverTime &&
      other.status == status;

    @override
    int get hashCode =>
        awayTeam.hashCode +
        competition.hashCode +
        (endedAt == null ? 0 : endedAt.hashCode) +
        homeTeam.hashCode +
        id.hashCode +
        kickoffAt.hashCode +
        predictable.hashCode +
        (roundLabel == null ? 0 : roundLabel.hashCode) +
        (score == null ? 0 : score.hashCode) +
        serverTime.hashCode +
        status.hashCode;

  factory MatchDetailDto.fromJson(Map<String, dynamic> json) => _$MatchDetailDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MatchDetailDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum MatchDetailDtoStatusEnum {
@JsonValue(r'SCHEDULED')
SCHEDULED(r'SCHEDULED'),
@JsonValue(r'LIVE')
LIVE(r'LIVE'),
@JsonValue(r'FINISHED')
FINISHED(r'FINISHED'),
@JsonValue(r'POSTPONED')
POSTPONED(r'POSTPONED'),
@JsonValue(r'CANCELLED')
CANCELLED(r'CANCELLED'),
@JsonValue(r'ABANDONED')
ABANDONED(r'ABANDONED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const MatchDetailDtoStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


