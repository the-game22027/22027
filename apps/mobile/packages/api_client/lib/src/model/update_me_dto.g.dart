// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_me_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateMeDtoCWProxy {
  UpdateMeDto avatarUrl(String? avatarUrl);

  UpdateMeDto displayName(String? displayName);

  UpdateMeDto favouriteTeamId(String? favouriteTeamId);

  UpdateMeDto locale(UpdateMeDtoLocaleEnum? locale);

  UpdateMeDto username(String? username);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateMeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateMeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateMeDto call({
    String? avatarUrl,
    String? displayName,
    String? favouriteTeamId,
    UpdateMeDtoLocaleEnum? locale,
    String? username,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateMeDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateMeDto.copyWith.fieldName(...)`
class _$UpdateMeDtoCWProxyImpl implements _$UpdateMeDtoCWProxy {
  const _$UpdateMeDtoCWProxyImpl(this._value);

  final UpdateMeDto _value;

  @override
  UpdateMeDto avatarUrl(String? avatarUrl) => this(avatarUrl: avatarUrl);

  @override
  UpdateMeDto displayName(String? displayName) =>
      this(displayName: displayName);

  @override
  UpdateMeDto favouriteTeamId(String? favouriteTeamId) =>
      this(favouriteTeamId: favouriteTeamId);

  @override
  UpdateMeDto locale(UpdateMeDtoLocaleEnum? locale) => this(locale: locale);

  @override
  UpdateMeDto username(String? username) => this(username: username);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateMeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateMeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateMeDto call({
    Object? avatarUrl = const $CopyWithPlaceholder(),
    Object? displayName = const $CopyWithPlaceholder(),
    Object? favouriteTeamId = const $CopyWithPlaceholder(),
    Object? locale = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
  }) {
    return UpdateMeDto(
      avatarUrl: avatarUrl == const $CopyWithPlaceholder()
          ? _value.avatarUrl
          // ignore: cast_nullable_to_non_nullable
          : avatarUrl as String?,
      displayName: displayName == const $CopyWithPlaceholder()
          ? _value.displayName
          // ignore: cast_nullable_to_non_nullable
          : displayName as String?,
      favouriteTeamId: favouriteTeamId == const $CopyWithPlaceholder()
          ? _value.favouriteTeamId
          // ignore: cast_nullable_to_non_nullable
          : favouriteTeamId as String?,
      locale: locale == const $CopyWithPlaceholder()
          ? _value.locale
          // ignore: cast_nullable_to_non_nullable
          : locale as UpdateMeDtoLocaleEnum?,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String?,
    );
  }
}

extension $UpdateMeDtoCopyWith on UpdateMeDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateMeDto.copyWith(...)` or like so:`instanceOfUpdateMeDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateMeDtoCWProxy get copyWith => _$UpdateMeDtoCWProxyImpl(this);
}
