//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/friend_prediction_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'friend_prediction_page_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FriendPredictionPageDto {
  /// Returns a new [FriendPredictionPageDto] instance.
  FriendPredictionPageDto({required this.items, required this.nextCursor});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<FriendPredictionDto> items;

  @JsonKey(name: r'nextCursor', required: true, includeIfNull: true)
  final String? nextCursor;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FriendPredictionPageDto &&
          other.items == items &&
          other.nextCursor == nextCursor;

  @override
  int get hashCode =>
      items.hashCode + (nextCursor == null ? 0 : nextCursor.hashCode);

  factory FriendPredictionPageDto.fromJson(Map<String, dynamic> json) =>
      _$FriendPredictionPageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$FriendPredictionPageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
