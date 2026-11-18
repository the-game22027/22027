// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leaderboard_period_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LeaderboardPeriodDtoCWProxy {
  LeaderboardPeriodDto endsAt(String? endsAt);

  LeaderboardPeriodDto key(String key);

  LeaderboardPeriodDto kind(LeaderboardPeriodDtoKindEnum kind);

  LeaderboardPeriodDto startsAt(String startsAt);

  LeaderboardPeriodDto status(LeaderboardPeriodDtoStatusEnum status);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardPeriodDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardPeriodDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardPeriodDto call({
    String? endsAt,
    String key,
    LeaderboardPeriodDtoKindEnum kind,
    String startsAt,
    LeaderboardPeriodDtoStatusEnum status,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLeaderboardPeriodDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLeaderboardPeriodDto.copyWith.fieldName(...)`
class _$LeaderboardPeriodDtoCWProxyImpl
    implements _$LeaderboardPeriodDtoCWProxy {
  const _$LeaderboardPeriodDtoCWProxyImpl(this._value);

  final LeaderboardPeriodDto _value;

  @override
  LeaderboardPeriodDto endsAt(String? endsAt) => this(endsAt: endsAt);

  @override
  LeaderboardPeriodDto key(String key) => this(key: key);

  @override
  LeaderboardPeriodDto kind(LeaderboardPeriodDtoKindEnum kind) =>
      this(kind: kind);

  @override
  LeaderboardPeriodDto startsAt(String startsAt) => this(startsAt: startsAt);

  @override
  LeaderboardPeriodDto status(LeaderboardPeriodDtoStatusEnum status) =>
      this(status: status);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardPeriodDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardPeriodDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardPeriodDto call({
    Object? endsAt = const $CopyWithPlaceholder(),
    Object? key = const $CopyWithPlaceholder(),
    Object? kind = const $CopyWithPlaceholder(),
    Object? startsAt = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
  }) {
    return LeaderboardPeriodDto(
      endsAt: endsAt == const $CopyWithPlaceholder()
          ? _value.endsAt
          // ignore: cast_nullable_to_non_nullable
          : endsAt as String?,
      key: key == const $CopyWithPlaceholder()
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as String,
      kind: kind == const $CopyWithPlaceholder()
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as LeaderboardPeriodDtoKindEnum,
      startsAt: startsAt == const $CopyWithPlaceholder()
          ? _value.startsAt
          // ignore: cast_nullable_to_non_nullable
          : startsAt as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as LeaderboardPeriodDtoStatusEnum,
    );
  }
}

extension $LeaderboardPeriodDtoCopyWith on LeaderboardPeriodDto {
  /// Returns a callable class that can be used as follows: `instanceOfLeaderboardPeriodDto.copyWith(...)` or like so:`instanceOfLeaderboardPeriodDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LeaderboardPeriodDtoCWProxy get copyWith =>
      _$LeaderboardPeriodDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LeaderboardPeriodDto _$LeaderboardPeriodDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LeaderboardPeriodDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['endsAt', 'key', 'kind', 'startsAt', 'status'],
  );
  final val = LeaderboardPeriodDto(
    endsAt: $checkedConvert('endsAt', (v) => v as String?),
    key: $checkedConvert('key', (v) => v as String),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(
        _$LeaderboardPeriodDtoKindEnumEnumMap,
        v,
        unknownValue: LeaderboardPeriodDtoKindEnum.unknownDefaultOpenApi,
      ),
    ),
    startsAt: $checkedConvert('startsAt', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$LeaderboardPeriodDtoStatusEnumEnumMap,
        v,
        unknownValue: LeaderboardPeriodDtoStatusEnum.unknownDefaultOpenApi,
      ),
    ),
  );
  return val;
});

Map<String, dynamic> _$LeaderboardPeriodDtoToJson(
  LeaderboardPeriodDto instance,
) => <String, dynamic>{
  'endsAt': instance.endsAt,
  'key': instance.key,
  'kind': _$LeaderboardPeriodDtoKindEnumEnumMap[instance.kind]!,
  'startsAt': instance.startsAt,
  'status': _$LeaderboardPeriodDtoStatusEnumEnumMap[instance.status]!,
};

const _$LeaderboardPeriodDtoKindEnumEnumMap = {
  LeaderboardPeriodDtoKindEnum.WEEKLY: 'WEEKLY',
  LeaderboardPeriodDtoKindEnum.MONTHLY: 'MONTHLY',
  LeaderboardPeriodDtoKindEnum.SEASONAL: 'SEASONAL',
  LeaderboardPeriodDtoKindEnum.ALL_TIME: 'ALL_TIME',
  LeaderboardPeriodDtoKindEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

const _$LeaderboardPeriodDtoStatusEnumEnumMap = {
  LeaderboardPeriodDtoStatusEnum.CLOSED: 'CLOSED',
  LeaderboardPeriodDtoStatusEnum.OPEN: 'OPEN',
  LeaderboardPeriodDtoStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
