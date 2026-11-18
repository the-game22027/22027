// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'send_friend_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SendFriendRequestDtoCWProxy {
  SendFriendRequestDto userId(String userId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SendFriendRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SendFriendRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SendFriendRequestDto call({String userId});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSendFriendRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSendFriendRequestDto.copyWith.fieldName(...)`
class _$SendFriendRequestDtoCWProxyImpl
    implements _$SendFriendRequestDtoCWProxy {
  const _$SendFriendRequestDtoCWProxyImpl(this._value);

  final SendFriendRequestDto _value;

  @override
  SendFriendRequestDto userId(String userId) => this(userId: userId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SendFriendRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SendFriendRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SendFriendRequestDto call({Object? userId = const $CopyWithPlaceholder()}) {
    return SendFriendRequestDto(
      userId: userId == const $CopyWithPlaceholder()
          ? _value.userId
          // ignore: cast_nullable_to_non_nullable
          : userId as String,
    );
  }
}

extension $SendFriendRequestDtoCopyWith on SendFriendRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfSendFriendRequestDto.copyWith(...)` or like so:`instanceOfSendFriendRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SendFriendRequestDtoCWProxy get copyWith =>
      _$SendFriendRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SendFriendRequestDto _$SendFriendRequestDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SendFriendRequestDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['userId']);
  final val = SendFriendRequestDto(
    userId: $checkedConvert('userId', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$SendFriendRequestDtoToJson(
  SendFriendRequestDto instance,
) => <String, dynamic>{'userId': instance.userId};
