// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_info_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SessionInfoDtoCWProxy {
  SessionInfoDto createdAt(String createdAt);

  SessionInfoDto current(bool current);

  SessionInfoDto deviceName(String? deviceName);

  SessionInfoDto id(String id);

  SessionInfoDto lastUsedAt(String lastUsedAt);

  SessionInfoDto platform(String? platform);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SessionInfoDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SessionInfoDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SessionInfoDto call({
    String createdAt,
    bool current,
    String? deviceName,
    String id,
    String lastUsedAt,
    String? platform,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSessionInfoDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSessionInfoDto.copyWith.fieldName(...)`
class _$SessionInfoDtoCWProxyImpl implements _$SessionInfoDtoCWProxy {
  const _$SessionInfoDtoCWProxyImpl(this._value);

  final SessionInfoDto _value;

  @override
  SessionInfoDto createdAt(String createdAt) => this(createdAt: createdAt);

  @override
  SessionInfoDto current(bool current) => this(current: current);

  @override
  SessionInfoDto deviceName(String? deviceName) => this(deviceName: deviceName);

  @override
  SessionInfoDto id(String id) => this(id: id);

  @override
  SessionInfoDto lastUsedAt(String lastUsedAt) => this(lastUsedAt: lastUsedAt);

  @override
  SessionInfoDto platform(String? platform) => this(platform: platform);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SessionInfoDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SessionInfoDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SessionInfoDto call({
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? current = const $CopyWithPlaceholder(),
    Object? deviceName = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? lastUsedAt = const $CopyWithPlaceholder(),
    Object? platform = const $CopyWithPlaceholder(),
  }) {
    return SessionInfoDto(
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as String,
      current: current == const $CopyWithPlaceholder()
          ? _value.current
          // ignore: cast_nullable_to_non_nullable
          : current as bool,
      deviceName: deviceName == const $CopyWithPlaceholder()
          ? _value.deviceName
          // ignore: cast_nullable_to_non_nullable
          : deviceName as String?,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      lastUsedAt: lastUsedAt == const $CopyWithPlaceholder()
          ? _value.lastUsedAt
          // ignore: cast_nullable_to_non_nullable
          : lastUsedAt as String,
      platform: platform == const $CopyWithPlaceholder()
          ? _value.platform
          // ignore: cast_nullable_to_non_nullable
          : platform as String?,
    );
  }
}

extension $SessionInfoDtoCopyWith on SessionInfoDto {
  /// Returns a callable class that can be used as follows: `instanceOfSessionInfoDto.copyWith(...)` or like so:`instanceOfSessionInfoDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SessionInfoDtoCWProxy get copyWith => _$SessionInfoDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionInfoDto _$SessionInfoDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SessionInfoDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['createdAt', 'current', 'id', 'lastUsedAt'],
      );
      final val = SessionInfoDto(
        createdAt: $checkedConvert('createdAt', (v) => v as String),
        current: $checkedConvert('current', (v) => v as bool),
        deviceName: $checkedConvert('deviceName', (v) => v as String?),
        id: $checkedConvert('id', (v) => v as String),
        lastUsedAt: $checkedConvert('lastUsedAt', (v) => v as String),
        platform: $checkedConvert('platform', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$SessionInfoDtoToJson(SessionInfoDto instance) =>
    <String, dynamic>{
      'createdAt': instance.createdAt,
      'current': instance.current,
      'deviceName': ?instance.deviceName,
      'id': instance.id,
      'lastUsedAt': instance.lastUsedAt,
      'platform': ?instance.platform,
    };
