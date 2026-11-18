// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'connected_user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ConnectedUserDtoCWProxy {
  ConnectedUserDto since(String since);

  ConnectedUserDto user(PublicUserDto user);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ConnectedUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ConnectedUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ConnectedUserDto call({String since, PublicUserDto user});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfConnectedUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfConnectedUserDto.copyWith.fieldName(...)`
class _$ConnectedUserDtoCWProxyImpl implements _$ConnectedUserDtoCWProxy {
  const _$ConnectedUserDtoCWProxyImpl(this._value);

  final ConnectedUserDto _value;

  @override
  ConnectedUserDto since(String since) => this(since: since);

  @override
  ConnectedUserDto user(PublicUserDto user) => this(user: user);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ConnectedUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ConnectedUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ConnectedUserDto call({
    Object? since = const $CopyWithPlaceholder(),
    Object? user = const $CopyWithPlaceholder(),
  }) {
    return ConnectedUserDto(
      since: since == const $CopyWithPlaceholder()
          ? _value.since
          // ignore: cast_nullable_to_non_nullable
          : since as String,
      user: user == const $CopyWithPlaceholder()
          ? _value.user
          // ignore: cast_nullable_to_non_nullable
          : user as PublicUserDto,
    );
  }
}

extension $ConnectedUserDtoCopyWith on ConnectedUserDto {
  /// Returns a callable class that can be used as follows: `instanceOfConnectedUserDto.copyWith(...)` or like so:`instanceOfConnectedUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ConnectedUserDtoCWProxy get copyWith => _$ConnectedUserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConnectedUserDto _$ConnectedUserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ConnectedUserDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['since', 'user']);
      final val = ConnectedUserDto(
        since: $checkedConvert('since', (v) => v as String),
        user: $checkedConvert(
          'user',
          (v) => PublicUserDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ConnectedUserDtoToJson(ConnectedUserDto instance) =>
    <String, dynamic>{'since': instance.since, 'user': instance.user.toJson()};
