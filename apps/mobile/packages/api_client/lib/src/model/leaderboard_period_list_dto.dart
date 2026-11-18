//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/leaderboard_period_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'leaderboard_period_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LeaderboardPeriodListDto {
  /// Returns a new [LeaderboardPeriodListDto] instance.
  LeaderboardPeriodListDto({required this.items});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<LeaderboardPeriodDto> items;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LeaderboardPeriodListDto && other.items == items;

  @override
  int get hashCode => items.hashCode;

  factory LeaderboardPeriodListDto.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardPeriodListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LeaderboardPeriodListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
