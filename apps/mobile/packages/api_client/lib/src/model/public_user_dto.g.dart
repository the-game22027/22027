// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'public_user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PublicUserDtoCWProxy {
  PublicUserDto avatarUrl(String? avatarUrl);

  PublicUserDto displayName(String displayName);

  PublicUserDto id(String id);

  PublicUserDto username(String? username);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PublicUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PublicUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PublicUserDto call({
    String? avatarUrl,
    String displayName,
    String id,
    String? username,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPublicUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPublicUserDto.copyWith.fieldName(...)`
class _$PublicUserDtoCWProxyImpl implements _$PublicUserDtoCWProxy {
  const _$PublicUserDtoCWProxyImpl(this._value);

  final PublicUserDto _value;

  @override
  PublicUserDto avatarUrl(String? avatarUrl) => this(avatarUrl: avatarUrl);

  @override
  PublicUserDto displayName(String displayName) =>
      this(displayName: displayName);

  @override
  PublicUserDto id(String id) => this(id: id);

  @override
  PublicUserDto username(String? username) => this(username: username);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PublicUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PublicUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PublicUserDto call({
    Object? avatarUrl = const $CopyWithPlaceholder(),
    Object? displayName = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
  }) {
    return PublicUserDto(
      avatarUrl: avatarUrl == const $CopyWithPlaceholder()
          ? _value.avatarUrl
          // ignore: cast_nullable_to_non_nullable
          : avatarUrl as String?,
      displayName: displayName == const $CopyWithPlaceholder()
          ? _value.displayName
          // ignore: cast_nullable_to_non_nullable
          : displayName as String,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String?,
    );
  }
}

extension $PublicUserDtoCopyWith on PublicUserDto {
  /// Returns a callable class that can be used as follows: `instanceOfPublicUserDto.copyWith(...)` or like so:`instanceOfPublicUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PublicUserDtoCWProxy get copyWith => _$PublicUserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PublicUserDto _$PublicUserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PublicUserDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['avatarUrl', 'displayName', 'id', 'username'],
      );
      final val = PublicUserDto(
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
        displayName: $checkedConvert('displayName', (v) => v as String),
        id: $checkedConvert('id', (v) => v as String),
        username: $checkedConvert('username', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$PublicUserDtoToJson(PublicUserDto instance) =>
    <String, dynamic>{
      'avatarUrl': instance.avatarUrl,
      'displayName': instance.displayName,
      'id': instance.id,
      'username': instance.username,
    };
