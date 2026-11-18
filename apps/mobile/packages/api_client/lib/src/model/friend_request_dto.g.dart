// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$FriendRequestDtoCWProxy {
  FriendRequestDto createdAt(String createdAt);

  FriendRequestDto from(PublicUserDto from);

  FriendRequestDto id(String id);

  FriendRequestDto status(FriendRequestDtoStatusEnum status);

  FriendRequestDto to(PublicUserDto to);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendRequestDto call({
    String createdAt,
    PublicUserDto from,
    String id,
    FriendRequestDtoStatusEnum status,
    PublicUserDto to,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfFriendRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfFriendRequestDto.copyWith.fieldName(...)`
class _$FriendRequestDtoCWProxyImpl implements _$FriendRequestDtoCWProxy {
  const _$FriendRequestDtoCWProxyImpl(this._value);

  final FriendRequestDto _value;

  @override
  FriendRequestDto createdAt(String createdAt) => this(createdAt: createdAt);

  @override
  FriendRequestDto from(PublicUserDto from) => this(from: from);

  @override
  FriendRequestDto id(String id) => this(id: id);

  @override
  FriendRequestDto status(FriendRequestDtoStatusEnum status) =>
      this(status: status);

  @override
  FriendRequestDto to(PublicUserDto to) => this(to: to);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendRequestDto call({
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? from = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? to = const $CopyWithPlaceholder(),
  }) {
    return FriendRequestDto(
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as String,
      from: from == const $CopyWithPlaceholder()
          ? _value.from
          // ignore: cast_nullable_to_non_nullable
          : from as PublicUserDto,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as FriendRequestDtoStatusEnum,
      to: to == const $CopyWithPlaceholder()
          ? _value.to
          // ignore: cast_nullable_to_non_nullable
          : to as PublicUserDto,
    );
  }
}

extension $FriendRequestDtoCopyWith on FriendRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfFriendRequestDto.copyWith(...)` or like so:`instanceOfFriendRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$FriendRequestDtoCWProxy get copyWith => _$FriendRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendRequestDto _$FriendRequestDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendRequestDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['createdAt', 'from', 'id', 'status', 'to'],
      );
      final val = FriendRequestDto(
        createdAt: $checkedConvert('createdAt', (v) => v as String),
        from: $checkedConvert(
          'from',
          (v) => PublicUserDto.fromJson(v as Map<String, dynamic>),
        ),
        id: $checkedConvert('id', (v) => v as String),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$FriendRequestDtoStatusEnumEnumMap,
            v,
            unknownValue: FriendRequestDtoStatusEnum.unknownDefaultOpenApi,
          ),
        ),
        to: $checkedConvert(
          'to',
          (v) => PublicUserDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendRequestDtoToJson(FriendRequestDto instance) =>
    <String, dynamic>{
      'createdAt': instance.createdAt,
      'from': instance.from.toJson(),
      'id': instance.id,
      'status': _$FriendRequestDtoStatusEnumEnumMap[instance.status]!,
      'to': instance.to.toJson(),
    };

const _$FriendRequestDtoStatusEnumEnumMap = {
  FriendRequestDtoStatusEnum.PENDING: 'PENDING',
  FriendRequestDtoStatusEnum.ACCEPTED: 'ACCEPTED',
  FriendRequestDtoStatusEnum.DECLINED: 'DECLINED',
  FriendRequestDtoStatusEnum.CANCELLED: 'CANCELLED',
  FriendRequestDtoStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
