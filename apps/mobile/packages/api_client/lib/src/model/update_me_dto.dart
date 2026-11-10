//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'update_me_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateMeDto {
  /// Returns a new [UpdateMeDto] instance.
  UpdateMeDto({
    this.avatarUrl,

    this.displayName,

    this.favouriteTeamId,

    this.locale,

    this.username,
  });

  @JsonKey(name: r'avatarUrl', required: false, includeIfNull: false)
  final String? avatarUrl;

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'favouriteTeamId', required: false, includeIfNull: false)
  final String? favouriteTeamId;

  @JsonKey(
    name: r'locale',
    required: false,
    includeIfNull: false,
    unknownEnumValue: UpdateMeDtoLocaleEnum.unknownDefaultOpenApi,
  )
  final UpdateMeDtoLocaleEnum? locale;

  @JsonKey(name: r'username', required: false, includeIfNull: false)
  final String? username;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UpdateMeDto &&
          other.avatarUrl == avatarUrl &&
          other.displayName == displayName &&
          other.favouriteTeamId == favouriteTeamId &&
          other.locale == locale &&
          other.username == username;

  @override
  int get hashCode =>
      (avatarUrl == null ? 0 : avatarUrl.hashCode) +
      displayName.hashCode +
      (favouriteTeamId == null ? 0 : favouriteTeamId.hashCode) +
      locale.hashCode +
      (username == null ? 0 : username.hashCode);

  factory UpdateMeDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateMeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateMeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum UpdateMeDtoLocaleEnum {
  @JsonValue(r'ar')
  ar(r'ar'),
  @JsonValue(r'en')
  en(r'en'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const UpdateMeDtoLocaleEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
