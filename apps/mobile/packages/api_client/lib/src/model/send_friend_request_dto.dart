//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'send_friend_request_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SendFriendRequestDto {
  /// Returns a new [SendFriendRequestDto] instance.
  SendFriendRequestDto({required this.userId});

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SendFriendRequestDto && other.userId == userId;

  @override
  int get hashCode => userId.hashCode;

  factory SendFriendRequestDto.fromJson(Map<String, dynamic> json) =>
      _$SendFriendRequestDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SendFriendRequestDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
