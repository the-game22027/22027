// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DeviceDtoCWProxy {
  DeviceDto name(String? name);

  DeviceDto platform(DeviceDtoPlatformEnum? platform);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceDto call({String? name, DeviceDtoPlatformEnum? platform});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDeviceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDeviceDto.copyWith.fieldName(...)`
class _$DeviceDtoCWProxyImpl implements _$DeviceDtoCWProxy {
  const _$DeviceDtoCWProxyImpl(this._value);

  final DeviceDto _value;

  @override
  DeviceDto name(String? name) => this(name: name);

  @override
  DeviceDto platform(DeviceDtoPlatformEnum? platform) =>
      this(platform: platform);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? platform = const $CopyWithPlaceholder(),
  }) {
    return DeviceDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String?,
      platform: platform == const $CopyWithPlaceholder()
          ? _value.platform
          // ignore: cast_nullable_to_non_nullable
          : platform as DeviceDtoPlatformEnum?,
    );
  }
}

extension $DeviceDtoCopyWith on DeviceDto {
  /// Returns a callable class that can be used as follows: `instanceOfDeviceDto.copyWith(...)` or like so:`instanceOfDeviceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DeviceDtoCWProxy get copyWith => _$DeviceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeviceDto _$DeviceDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DeviceDto', json, ($checkedConvert) {
      final val = DeviceDto(
        name: $checkedConvert('name', (v) => v as String?),
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecodeNullable(
            _$DeviceDtoPlatformEnumEnumMap,
            v,
            unknownValue: DeviceDtoPlatformEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DeviceDtoToJson(DeviceDto instance) => <String, dynamic>{
  'name': ?instance.name,
  'platform': ?_$DeviceDtoPlatformEnumEnumMap[instance.platform],
};

const _$DeviceDtoPlatformEnumEnumMap = {
  DeviceDtoPlatformEnum.ios: 'ios',
  DeviceDtoPlatformEnum.android: 'android',
  DeviceDtoPlatformEnum.web: 'web',
  DeviceDtoPlatformEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
