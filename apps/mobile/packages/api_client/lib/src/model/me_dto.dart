//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/identity_dto.dart';
import 'package:api_client/src/model/privacy_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeDto {
  /// Returns a new [MeDto] instance.
  MeDto({
    required this.avatarUrl,

    required this.displayName,

    required this.favouriteTeamId,

    required this.id,

    required this.identities,

    required this.locale,

    required this.privacy,

    required this.username,
  });

  @JsonKey(name: r'avatarUrl', required: true, includeIfNull: true)
  final String? avatarUrl;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'favouriteTeamId', required: true, includeIfNull: true)
  final String? favouriteTeamId;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'identities', required: true, includeIfNull: false)
  final List<IdentityDto> identities;

  @JsonKey(name: r'locale', required: true, includeIfNull: false)
  final String locale;

  @JsonKey(name: r'privacy', required: true, includeIfNull: false)
  final PrivacyDto privacy;

  @JsonKey(name: r'username', required: true, includeIfNull: true)
  final String? username;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MeDto &&
          other.avatarUrl == avatarUrl &&
          other.displayName == displayName &&
          other.favouriteTeamId == favouriteTeamId &&
          other.id == id &&
          other.identities == identities &&
          other.locale == locale &&
          other.privacy == privacy &&
          other.username == username;

  @override
  int get hashCode =>
      (avatarUrl == null ? 0 : avatarUrl.hashCode) +
      displayName.hashCode +
      (favouriteTeamId == null ? 0 : favouriteTeamId.hashCode) +
      id.hashCode +
      identities.hashCode +
      locale.hashCode +
      privacy.hashCode +
      (username == null ? 0 : username.hashCode);

  factory MeDto.fromJson(Map<String, dynamic> json) => _$MeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
