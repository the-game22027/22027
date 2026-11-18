//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'prediction_score_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PredictionScoreDto {
  /// Returns a new [PredictionScoreDto] instance.
  PredictionScoreDto({required this.points});

  @JsonKey(name: r'points', required: true, includeIfNull: false)
  final num points;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PredictionScoreDto && other.points == points;

  @override
  int get hashCode => points.hashCode;

  factory PredictionScoreDto.fromJson(Map<String, dynamic> json) =>
      _$PredictionScoreDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PredictionScoreDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
