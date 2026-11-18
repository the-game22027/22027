// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leaderboard_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LeaderboardPageDtoCWProxy {
  LeaderboardPageDto category(LeaderboardPageDtoCategoryEnum category);

  LeaderboardPageDto items(List<LeaderboardRowDto> items);

  LeaderboardPageDto nextCursor(String? nextCursor);

  LeaderboardPageDto period(LeaderboardPeriodDto period);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardPageDto call({
    LeaderboardPageDtoCategoryEnum category,
    List<LeaderboardRowDto> items,
    String? nextCursor,
    LeaderboardPeriodDto period,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLeaderboardPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLeaderboardPageDto.copyWith.fieldName(...)`
class _$LeaderboardPageDtoCWProxyImpl implements _$LeaderboardPageDtoCWProxy {
  const _$LeaderboardPageDtoCWProxyImpl(this._value);

  final LeaderboardPageDto _value;

  @override
  LeaderboardPageDto category(LeaderboardPageDtoCategoryEnum category) =>
      this(category: category);

  @override
  LeaderboardPageDto items(List<LeaderboardRowDto> items) => this(items: items);

  @override
  LeaderboardPageDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  LeaderboardPageDto period(LeaderboardPeriodDto period) =>
      this(period: period);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardPageDto call({
    Object? category = const $CopyWithPlaceholder(),
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
    Object? period = const $CopyWithPlaceholder(),
  }) {
    return LeaderboardPageDto(
      category: category == const $CopyWithPlaceholder()
          ? _value.category
          // ignore: cast_nullable_to_non_nullable
          : category as LeaderboardPageDtoCategoryEnum,
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<LeaderboardRowDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
      period: period == const $CopyWithPlaceholder()
          ? _value.period
          // ignore: cast_nullable_to_non_nullable
          : period as LeaderboardPeriodDto,
    );
  }
}

extension $LeaderboardPageDtoCopyWith on LeaderboardPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfLeaderboardPageDto.copyWith(...)` or like so:`instanceOfLeaderboardPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LeaderboardPageDtoCWProxy get copyWith =>
      _$LeaderboardPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LeaderboardPageDto _$LeaderboardPageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LeaderboardPageDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['category', 'items', 'nextCursor', 'period'],
      );
      final val = LeaderboardPageDto(
        category: $checkedConvert(
          'category',
          (v) => $enumDecode(
            _$LeaderboardPageDtoCategoryEnumEnumMap,
            v,
            unknownValue: LeaderboardPageDtoCategoryEnum.unknownDefaultOpenApi,
          ),
        ),
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => LeaderboardRowDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
        period: $checkedConvert(
          'period',
          (v) => LeaderboardPeriodDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LeaderboardPageDtoToJson(LeaderboardPageDto instance) =>
    <String, dynamic>{
      'category': _$LeaderboardPageDtoCategoryEnumEnumMap[instance.category]!,
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
      'period': instance.period.toJson(),
    };

const _$LeaderboardPageDtoCategoryEnumEnumMap = {
  LeaderboardPageDtoCategoryEnum.BATTLES: 'BATTLES',
  LeaderboardPageDtoCategoryEnum.PREDICTIONS: 'PREDICTIONS',
  LeaderboardPageDtoCategoryEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
