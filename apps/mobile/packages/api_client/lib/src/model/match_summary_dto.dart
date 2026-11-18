//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/match_competition_dto.dart';
import 'package:api_client/src/model/score_dto.dart';
import 'package:api_client/src/model/team_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'match_summary_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MatchSummaryDto {
  /// Returns a new [MatchSummaryDto] instance.
  MatchSummaryDto({
    required this.awayTeam,

    required this.competition,

    required this.homeTeam,

    required this.id,

    required this.kickoffAt,

    required this.predictable,

    required this.roundLabel,

    required this.score,

    required this.status,
  });

  @JsonKey(name: r'awayTeam', required: true, includeIfNull: false)
  final TeamDto awayTeam;

  @JsonKey(name: r'competition', required: true, includeIfNull: false)
  final MatchCompetitionDto competition;

  @JsonKey(name: r'homeTeam', required: true, includeIfNull: false)
  final TeamDto homeTeam;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'kickoffAt', required: true, includeIfNull: false)
  final String kickoffAt;

  @JsonKey(name: r'predictable', required: true, includeIfNull: false)
  final bool predictable;

  @JsonKey(name: r'roundLabel', required: true, includeIfNull: true)
  final String? roundLabel;

  @JsonKey(name: r'score', required: true, includeIfNull: true)
  final ScoreDto? score;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: MatchSummaryDtoStatusEnum.unknownDefaultOpenApi,
  )
  final MatchSummaryDtoStatusEnum status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MatchSummaryDto &&
          other.awayTeam == awayTeam &&
          other.competition == competition &&
          other.homeTeam == homeTeam &&
          other.id == id &&
          other.kickoffAt == kickoffAt &&
          other.predictable == predictable &&
          other.roundLabel == roundLabel &&
          other.score == score &&
          other.status == status;

  @override
  int get hashCode =>
      awayTeam.hashCode +
      competition.hashCode +
      homeTeam.hashCode +
      id.hashCode +
      kickoffAt.hashCode +
      predictable.hashCode +
      (roundLabel == null ? 0 : roundLabel.hashCode) +
      (score == null ? 0 : score.hashCode) +
      status.hashCode;

  factory MatchSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$MatchSummaryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MatchSummaryDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum MatchSummaryDtoStatusEnum {
  @JsonValue(r'CANCELLED')
  CANCELLED(r'CANCELLED'),
  @JsonValue(r'SCHEDULED')
  SCHEDULED(r'SCHEDULED'),
  @JsonValue(r'FINISHED')
  FINISHED(r'FINISHED'),
  @JsonValue(r'ABANDONED')
  ABANDONED(r'ABANDONED'),
  @JsonValue(r'LIVE')
  LIVE(r'LIVE'),
  @JsonValue(r'POSTPONED')
  POSTPONED(r'POSTPONED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const MatchSummaryDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
