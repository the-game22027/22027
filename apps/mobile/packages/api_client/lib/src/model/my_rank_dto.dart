//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/leaderboard_row_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_rank_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyRankDto {
  /// Returns a new [MyRankDto] instance.
  MyRankDto({required this.around, required this.points, required this.rank});

  @JsonKey(name: r'around', required: true, includeIfNull: false)
  final List<LeaderboardRowDto> around;

  @JsonKey(name: r'points', required: true, includeIfNull: false)
  final num points;

  /// null: no points in this period yet.
  @JsonKey(name: r'rank', required: true, includeIfNull: true)
  final num? rank;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MyRankDto &&
          other.around == around &&
          other.points == points &&
          other.rank == rank;

  @override
  int get hashCode =>
      around.hashCode + points.hashCode + (rank == null ? 0 : rank.hashCode);

  factory MyRankDto.fromJson(Map<String, dynamic> json) =>
      _$MyRankDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MyRankDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
