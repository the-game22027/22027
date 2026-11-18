//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/public_user_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'friend_request_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FriendRequestDto {
  /// Returns a new [FriendRequestDto] instance.
  FriendRequestDto({
    required this.createdAt,

    required this.from,

    required this.id,

    required this.status,

    required this.to,
  });

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final String createdAt;

  @JsonKey(name: r'from', required: true, includeIfNull: false)
  final PublicUserDto from;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: FriendRequestDtoStatusEnum.unknownDefaultOpenApi,
  )
  final FriendRequestDtoStatusEnum status;

  @JsonKey(name: r'to', required: true, includeIfNull: false)
  final PublicUserDto to;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FriendRequestDto &&
          other.createdAt == createdAt &&
          other.from == from &&
          other.id == id &&
          other.status == status &&
          other.to == to;

  @override
  int get hashCode =>
      createdAt.hashCode +
      from.hashCode +
      id.hashCode +
      status.hashCode +
      to.hashCode;

  factory FriendRequestDto.fromJson(Map<String, dynamic> json) =>
      _$FriendRequestDtoFromJson(json);

  Map<String, dynamic> toJson() => _$FriendRequestDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum FriendRequestDtoStatusEnum {
  @JsonValue(r'PENDING')
  PENDING(r'PENDING'),
  @JsonValue(r'ACCEPTED')
  ACCEPTED(r'ACCEPTED'),
  @JsonValue(r'DECLINED')
  DECLINED(r'DECLINED'),
  @JsonValue(r'CANCELLED')
  CANCELLED(r'CANCELLED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const FriendRequestDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
