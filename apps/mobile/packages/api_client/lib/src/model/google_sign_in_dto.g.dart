// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'google_sign_in_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$GoogleSignInDtoCWProxy {
  GoogleSignInDto device(DeviceDto? device);

  GoogleSignInDto idToken(String idToken);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `GoogleSignInDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// GoogleSignInDto(...).copyWith(id: 12, name: "My name")
  /// ````
  GoogleSignInDto call({DeviceDto? device, String idToken});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfGoogleSignInDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfGoogleSignInDto.copyWith.fieldName(...)`
class _$GoogleSignInDtoCWProxyImpl implements _$GoogleSignInDtoCWProxy {
  const _$GoogleSignInDtoCWProxyImpl(this._value);

  final GoogleSignInDto _value;

  @override
  GoogleSignInDto device(DeviceDto? device) => this(device: device);

  @override
  GoogleSignInDto idToken(String idToken) => this(idToken: idToken);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `GoogleSignInDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// GoogleSignInDto(...).copyWith(id: 12, name: "My name")
  /// ````
  GoogleSignInDto call({
    Object? device = const $CopyWithPlaceholder(),
    Object? idToken = const $CopyWithPlaceholder(),
  }) {
    return GoogleSignInDto(
      device: device == const $CopyWithPlaceholder()
          ? _value.device
          // ignore: cast_nullable_to_non_nullable
          : device as DeviceDto?,
      idToken: idToken == const $CopyWithPlaceholder()
          ? _value.idToken
          // ignore: cast_nullable_to_non_nullable
          : idToken as String,
    );
  }
}

extension $GoogleSignInDtoCopyWith on GoogleSignInDto {
  /// Returns a callable class that can be used as follows: `instanceOfGoogleSignInDto.copyWith(...)` or like so:`instanceOfGoogleSignInDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$GoogleSignInDtoCWProxy get copyWith => _$GoogleSignInDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GoogleSignInDto _$GoogleSignInDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('GoogleSignInDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['idToken']);
      final val = GoogleSignInDto(
        device: $checkedConvert(
          'device',
          (v) =>
              v == null ? null : DeviceDto.fromJson(v as Map<String, dynamic>),
        ),
        idToken: $checkedConvert('idToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$GoogleSignInDtoToJson(GoogleSignInDto instance) =>
    <String, dynamic>{
      'device': ?instance.device?.toJson(),
      'idToken': instance.idToken,
    };
