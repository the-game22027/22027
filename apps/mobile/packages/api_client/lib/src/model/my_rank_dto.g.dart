// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_rank_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MyRankDtoCWProxy {
  MyRankDto around(List<LeaderboardRowDto> around);

  MyRankDto points(num points);

  MyRankDto rank(num? rank);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MyRankDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MyRankDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MyRankDto call({List<LeaderboardRowDto> around, num points, num? rank});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMyRankDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMyRankDto.copyWith.fieldName(...)`
class _$MyRankDtoCWProxyImpl implements _$MyRankDtoCWProxy {
  const _$MyRankDtoCWProxyImpl(this._value);

  final MyRankDto _value;

  @override
  MyRankDto around(List<LeaderboardRowDto> around) => this(around: around);

  @override
  MyRankDto points(num points) => this(points: points);

  @override
  MyRankDto rank(num? rank) => this(rank: rank);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MyRankDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MyRankDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MyRankDto call({
    Object? around = const $CopyWithPlaceholder(),
    Object? points = const $CopyWithPlaceholder(),
    Object? rank = const $CopyWithPlaceholder(),
  }) {
    return MyRankDto(
      around: around == const $CopyWithPlaceholder()
          ? _value.around
          // ignore: cast_nullable_to_non_nullable
          : around as List<LeaderboardRowDto>,
      points: points == const $CopyWithPlaceholder()
          ? _value.points
          // ignore: cast_nullable_to_non_nullable
          : points as num,
      rank: rank == const $CopyWithPlaceholder()
          ? _value.rank
          // ignore: cast_nullable_to_non_nullable
          : rank as num?,
    );
  }
}

extension $MyRankDtoCopyWith on MyRankDto {
  /// Returns a callable class that can be used as follows: `instanceOfMyRankDto.copyWith(...)` or like so:`instanceOfMyRankDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MyRankDtoCWProxy get copyWith => _$MyRankDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyRankDto _$MyRankDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MyRankDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['around', 'points', 'rank']);
      final val = MyRankDto(
        around: $checkedConvert(
          'around',
          (v) => (v as List<dynamic>)
              .map((e) => LeaderboardRowDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        points: $checkedConvert('points', (v) => v as num),
        rank: $checkedConvert('rank', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$MyRankDtoToJson(MyRankDto instance) => <String, dynamic>{
  'around': instance.around.map((e) => e.toJson()).toList(),
  'points': instance.points,
  'rank': instance.rank,
};
