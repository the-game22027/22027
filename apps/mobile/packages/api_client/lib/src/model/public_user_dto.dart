//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'public_user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PublicUserDto {
  /// Returns a new [PublicUserDto] instance.
  PublicUserDto({
    required this.avatarUrl,

    required this.displayName,

    required this.id,

    required this.username,
  });

  @JsonKey(name: r'avatarUrl', required: true, includeIfNull: true)
  final String? avatarUrl;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'username', required: true, includeIfNull: true)
  final String? username;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PublicUserDto &&
          other.avatarUrl == avatarUrl &&
          other.displayName == displayName &&
          other.id == id &&
          other.username == username;

  @override
  int get hashCode =>
      (avatarUrl == null ? 0 : avatarUrl.hashCode) +
      displayName.hashCode +
      id.hashCode +
      (username == null ? 0 : username.hashCode);

  factory PublicUserDto.fromJson(Map<String, dynamic> json) =>
      _$PublicUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PublicUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
