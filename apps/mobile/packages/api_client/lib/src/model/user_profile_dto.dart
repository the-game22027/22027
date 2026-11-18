//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'user_profile_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UserProfileDto {
  /// Returns a new [UserProfileDto] instance.
  UserProfileDto({
    required this.avatarUrl,

    required this.displayName,

    required this.id,

    required this.relationship,

    required this.requestId,

    required this.username,
  });

  @JsonKey(name: r'avatarUrl', required: true, includeIfNull: true)
  final String? avatarUrl;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'relationship',
    required: true,
    includeIfNull: false,
    unknownEnumValue: UserProfileDtoRelationshipEnum.unknownDefaultOpenApi,
  )
  final UserProfileDtoRelationshipEnum relationship;

  /// Set for REQUEST_SENT and REQUEST_RECEIVED, so the app can cancel or accept.
  @JsonKey(name: r'requestId', required: true, includeIfNull: true)
  final String? requestId;

  @JsonKey(name: r'username', required: true, includeIfNull: true)
  final String? username;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserProfileDto &&
          other.avatarUrl == avatarUrl &&
          other.displayName == displayName &&
          other.id == id &&
          other.relationship == relationship &&
          other.requestId == requestId &&
          other.username == username;

  @override
  int get hashCode =>
      (avatarUrl == null ? 0 : avatarUrl.hashCode) +
      displayName.hashCode +
      id.hashCode +
      relationship.hashCode +
      (requestId == null ? 0 : requestId.hashCode) +
      (username == null ? 0 : username.hashCode);

  factory UserProfileDto.fromJson(Map<String, dynamic> json) =>
      _$UserProfileDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UserProfileDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum UserProfileDtoRelationshipEnum {
  @JsonValue(r'SELF')
  SELF(r'SELF'),
  @JsonValue(r'NONE')
  NONE(r'NONE'),
  @JsonValue(r'FRIENDS')
  FRIENDS(r'FRIENDS'),
  @JsonValue(r'REQUEST_SENT')
  REQUEST_SENT(r'REQUEST_SENT'),
  @JsonValue(r'REQUEST_RECEIVED')
  REQUEST_RECEIVED(r'REQUEST_RECEIVED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const UserProfileDtoRelationshipEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
