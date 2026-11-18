//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/friend_request_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'friend_request_page_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FriendRequestPageDto {
  /// Returns a new [FriendRequestPageDto] instance.
  FriendRequestPageDto({required this.items, required this.nextCursor});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<FriendRequestDto> items;

  @JsonKey(name: r'nextCursor', required: true, includeIfNull: true)
  final String? nextCursor;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FriendRequestPageDto &&
          other.items == items &&
          other.nextCursor == nextCursor;

  @override
  int get hashCode =>
      items.hashCode + (nextCursor == null ? 0 : nextCursor.hashCode);

  factory FriendRequestPageDto.fromJson(Map<String, dynamic> json) =>
      _$FriendRequestPageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$FriendRequestPageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
