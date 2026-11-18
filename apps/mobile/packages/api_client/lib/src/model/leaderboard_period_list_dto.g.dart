// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leaderboard_period_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LeaderboardPeriodListDtoCWProxy {
  LeaderboardPeriodListDto items(List<LeaderboardPeriodDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardPeriodListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardPeriodListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardPeriodListDto call({List<LeaderboardPeriodDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLeaderboardPeriodListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLeaderboardPeriodListDto.copyWith.fieldName(...)`
class _$LeaderboardPeriodListDtoCWProxyImpl
    implements _$LeaderboardPeriodListDtoCWProxy {
  const _$LeaderboardPeriodListDtoCWProxyImpl(this._value);

  final LeaderboardPeriodListDto _value;

  @override
  LeaderboardPeriodListDto items(List<LeaderboardPeriodDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardPeriodListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardPeriodListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardPeriodListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return LeaderboardPeriodListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<LeaderboardPeriodDto>,
    );
  }
}

extension $LeaderboardPeriodListDtoCopyWith on LeaderboardPeriodListDto {
  /// Returns a callable class that can be used as follows: `instanceOfLeaderboardPeriodListDto.copyWith(...)` or like so:`instanceOfLeaderboardPeriodListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LeaderboardPeriodListDtoCWProxy get copyWith =>
      _$LeaderboardPeriodListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LeaderboardPeriodListDto _$LeaderboardPeriodListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LeaderboardPeriodListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = LeaderboardPeriodListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => LeaderboardPeriodDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$LeaderboardPeriodListDtoToJson(
  LeaderboardPeriodListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
