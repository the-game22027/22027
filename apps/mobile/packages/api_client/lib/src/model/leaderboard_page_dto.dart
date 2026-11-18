//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/leaderboard_row_dto.dart';
import 'package:api_client/src/model/leaderboard_period_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'leaderboard_page_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LeaderboardPageDto {
  /// Returns a new [LeaderboardPageDto] instance.
  LeaderboardPageDto({
    required this.category,

    required this.items,

    required this.nextCursor,

    required this.period,
  });

  @JsonKey(
    name: r'category',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LeaderboardPageDtoCategoryEnum.unknownDefaultOpenApi,
  )
  final LeaderboardPageDtoCategoryEnum category;

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<LeaderboardRowDto> items;

  @JsonKey(name: r'nextCursor', required: true, includeIfNull: true)
  final String? nextCursor;

  @JsonKey(name: r'period', required: true, includeIfNull: false)
  final LeaderboardPeriodDto period;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LeaderboardPageDto &&
          other.category == category &&
          other.items == items &&
          other.nextCursor == nextCursor &&
          other.period == period;

  @override
  int get hashCode =>
      category.hashCode +
      items.hashCode +
      (nextCursor == null ? 0 : nextCursor.hashCode) +
      period.hashCode;

  factory LeaderboardPageDto.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardPageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LeaderboardPageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum LeaderboardPageDtoCategoryEnum {
  @JsonValue(r'BATTLES')
  BATTLES(r'BATTLES'),
  @JsonValue(r'PREDICTIONS')
  PREDICTIONS(r'PREDICTIONS'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LeaderboardPageDtoCategoryEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
