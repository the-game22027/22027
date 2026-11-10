// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MeDtoCWProxy {
  MeDto avatarUrl(String? avatarUrl);

  MeDto displayName(String displayName);

  MeDto favouriteTeamId(String? favouriteTeamId);

  MeDto id(String id);

  MeDto identities(List<IdentityDto> identities);

  MeDto locale(String locale);

  MeDto privacy(PrivacyDto privacy);

  MeDto username(String? username);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MeDto call({
    String? avatarUrl,
    String displayName,
    String? favouriteTeamId,
    String id,
    List<IdentityDto> identities,
    String locale,
    PrivacyDto privacy,
    String? username,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMeDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMeDto.copyWith.fieldName(...)`
class _$MeDtoCWProxyImpl implements _$MeDtoCWProxy {
  const _$MeDtoCWProxyImpl(this._value);

  final MeDto _value;

  @override
  MeDto avatarUrl(String? avatarUrl) => this(avatarUrl: avatarUrl);

  @override
  MeDto displayName(String displayName) => this(displayName: displayName);

  @override
  MeDto favouriteTeamId(String? favouriteTeamId) =>
      this(favouriteTeamId: favouriteTeamId);

  @override
  MeDto id(String id) => this(id: id);

  @override
  MeDto identities(List<IdentityDto> identities) =>
      this(identities: identities);

  @override
  MeDto locale(String locale) => this(locale: locale);

  @override
  MeDto privacy(PrivacyDto privacy) => this(privacy: privacy);

  @override
  MeDto username(String? username) => this(username: username);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MeDto call({
    Object? avatarUrl = const $CopyWithPlaceholder(),
    Object? displayName = const $CopyWithPlaceholder(),
    Object? favouriteTeamId = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? identities = const $CopyWithPlaceholder(),
    Object? locale = const $CopyWithPlaceholder(),
    Object? privacy = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
  }) {
    return MeDto(
      avatarUrl: avatarUrl == const $CopyWithPlaceholder()
          ? _value.avatarUrl
          // ignore: cast_nullable_to_non_nullable
          : avatarUrl as String?,
      displayName: displayName == const $CopyWithPlaceholder()
          ? _value.displayName
          // ignore: cast_nullable_to_non_nullable
          : displayName as String,
      favouriteTeamId: favouriteTeamId == const $CopyWithPlaceholder()
          ? _value.favouriteTeamId
          // ignore: cast_nullable_to_non_nullable
          : favouriteTeamId as String?,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      identities: identities == const $CopyWithPlaceholder()
          ? _value.identities
          // ignore: cast_nullable_to_non_nullable
          : identities as List<IdentityDto>,
      locale: locale == const $CopyWithPlaceholder()
          ? _value.locale
          // ignore: cast_nullable_to_non_nullable
          : locale as String,
      privacy: privacy == const $CopyWithPlaceholder()
          ? _value.privacy
          // ignore: cast_nullable_to_non_nullable
          : privacy as PrivacyDto,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String?,
    );
  }
}

extension $MeDtoCopyWith on MeDto {
  /// Returns a callable class that can be used as follows: `instanceOfMeDto.copyWith(...)` or like so:`instanceOfMeDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MeDtoCWProxy get copyWith => _$MeDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeDto _$MeDtoFromJson(Map<String, dynamic> json) => $checkedCreate(
  'MeDto',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'avatarUrl',
        'displayName',
        'favouriteTeamId',
        'id',
        'identities',
        'locale',
        'privacy',
        'username',
      ],
    );
    final val = MeDto(
      avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
      displayName: $checkedConvert('displayName', (v) => v as String),
      favouriteTeamId: $checkedConvert('favouriteTeamId', (v) => v as String?),
      id: $checkedConvert('id', (v) => v as String),
      identities: $checkedConvert(
        'identities',
        (v) => (v as List<dynamic>)
            .map((e) => IdentityDto.fromJson(e as Map<String, dynamic>))
            .toList(),
      ),
      locale: $checkedConvert('locale', (v) => v as String),
      privacy: $checkedConvert(
        'privacy',
        (v) => PrivacyDto.fromJson(v as Map<String, dynamic>),
      ),
      username: $checkedConvert('username', (v) => v as String?),
    );
    return val;
  },
);

Map<String, dynamic> _$MeDtoToJson(MeDto instance) => <String, dynamic>{
  'avatarUrl': instance.avatarUrl,
  'displayName': instance.displayName,
  'favouriteTeamId': instance.favouriteTeamId,
  'id': instance.id,
  'identities': instance.identities.map((e) => e.toJson()).toList(),
  'locale': instance.locale,
  'privacy': instance.privacy.toJson(),
  'username': instance.username,
};
