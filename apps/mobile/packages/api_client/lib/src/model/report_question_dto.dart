//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'report_question_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReportQuestionDto {
  /// Returns a new [ReportQuestionDto] instance.
  ReportQuestionDto({required this.reason});

  /// What is wrong with the question, in the player's words.
  @JsonKey(name: r'reason', required: true, includeIfNull: false)
  final String reason;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ReportQuestionDto && other.reason == reason;

  @override
  int get hashCode => reason.hashCode;

  factory ReportQuestionDto.fromJson(Map<String, dynamic> json) =>
      _$ReportQuestionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReportQuestionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
