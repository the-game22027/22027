// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dev_sign_in_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DevSignInDtoCWProxy {
  DevSignInDto device(DeviceDto? device);

  DevSignInDto displayName(String? displayName);

  DevSignInDto subject(String subject);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DevSignInDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DevSignInDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DevSignInDto call({DeviceDto? device, String? displayName, String subject});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDevSignInDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDevSignInDto.copyWith.fieldName(...)`
class _$DevSignInDtoCWProxyImpl implements _$DevSignInDtoCWProxy {
  const _$DevSignInDtoCWProxyImpl(this._value);

  final DevSignInDto _value;

  @override
  DevSignInDto device(DeviceDto? device) => this(device: device);

  @override
  DevSignInDto displayName(String? displayName) =>
      this(displayName: displayName);

  @override
  DevSignInDto subject(String subject) => this(subject: subject);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DevSignInDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DevSignInDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DevSignInDto call({
    Object? device = const $CopyWithPlaceholder(),
    Object? displayName = const $CopyWithPlaceholder(),
    Object? subject = const $CopyWithPlaceholder(),
  }) {
    return DevSignInDto(
      device: device == const $CopyWithPlaceholder()
          ? _value.device
          // ignore: cast_nullable_to_non_nullable
          : device as DeviceDto?,
      displayName: displayName == const $CopyWithPlaceholder()
          ? _value.displayName
          // ignore: cast_nullable_to_non_nullable
          : displayName as String?,
      subject: subject == const $CopyWithPlaceholder()
          ? _value.subject
          // ignore: cast_nullable_to_non_nullable
          : subject as String,
    );
  }
}

extension $DevSignInDtoCopyWith on DevSignInDto {
  /// Returns a callable class that can be used as follows: `instanceOfDevSignInDto.copyWith(...)` or like so:`instanceOfDevSignInDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DevSignInDtoCWProxy get copyWith => _$DevSignInDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DevSignInDto _$DevSignInDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DevSignInDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['subject']);
      final val = DevSignInDto(
        device: $checkedConvert(
          'device',
          (v) =>
              v == null ? null : DeviceDto.fromJson(v as Map<String, dynamic>),
        ),
        displayName: $checkedConvert('displayName', (v) => v as String?),
        subject: $checkedConvert('subject', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DevSignInDtoToJson(DevSignInDto instance) =>
    <String, dynamic>{
      'device': ?instance.device?.toJson(),
      'displayName': ?instance.displayName,
      'subject': instance.subject,
    };
