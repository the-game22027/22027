//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/prediction_pick_dto.dart';
import 'package:api_client/src/model/prediction_score_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'visible_prediction_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiblePredictionDto {
  /// Returns a new [VisiblePredictionDto] instance.
  VisiblePredictionDto({
    required this.matchId,

    required this.picks,

    required this.score,

    required this.status,

    required this.updatedAt,
  });

  @JsonKey(name: r'matchId', required: true, includeIfNull: false)
  final String matchId;

  @JsonKey(name: r'picks', required: true, includeIfNull: false)
  final List<PredictionPickDto> picks;

  /// null until prediction scoring exists (P3.2).
  @JsonKey(name: r'score', required: true, includeIfNull: true)
  final PredictionScoreDto? score;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: VisiblePredictionDtoStatusEnum.unknownDefaultOpenApi,
  )
  final VisiblePredictionDtoStatusEnum status;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final String updatedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VisiblePredictionDto &&
          other.matchId == matchId &&
          other.picks == picks &&
          other.score == score &&
          other.status == status &&
          other.updatedAt == updatedAt;

  @override
  int get hashCode =>
      matchId.hashCode +
      picks.hashCode +
      (score == null ? 0 : score.hashCode) +
      status.hashCode +
      updatedAt.hashCode;

  factory VisiblePredictionDto.fromJson(Map<String, dynamic> json) =>
      _$VisiblePredictionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiblePredictionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum VisiblePredictionDtoStatusEnum {
  @JsonValue(r'ACTIVE')
  ACTIVE(r'ACTIVE'),
  @JsonValue(r'VOID')
  VOID(r'VOID'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const VisiblePredictionDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
