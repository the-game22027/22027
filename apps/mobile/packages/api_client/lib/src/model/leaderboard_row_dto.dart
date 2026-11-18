//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/public_user_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'leaderboard_row_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LeaderboardRowDto {
  /// Returns a new [LeaderboardRowDto] instance.
  LeaderboardRowDto({
    required this.isMe,

    required this.points,

    required this.rank,

    required this.user,
  });

  @JsonKey(name: r'isMe', required: true, includeIfNull: false)
  final bool isMe;

  @JsonKey(name: r'points', required: true, includeIfNull: false)
  final num points;

  @JsonKey(name: r'rank', required: true, includeIfNull: false)
  final num rank;

  @JsonKey(name: r'user', required: true, includeIfNull: false)
  final PublicUserDto user;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LeaderboardRowDto &&
          other.isMe == isMe &&
          other.points == points &&
          other.rank == rank &&
          other.user == user;

  @override
  int get hashCode =>
      isMe.hashCode + points.hashCode + rank.hashCode + user.hashCode;

  factory LeaderboardRowDto.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardRowDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LeaderboardRowDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
