// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'score_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ScoreDtoCWProxy {
  ScoreDto away(num away);

  ScoreDto decidedBy(String? decidedBy);

  ScoreDto home(num home);

  ScoreDto penalties(PenaltiesDto? penalties);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ScoreDto call({
    num away,
    String? decidedBy,
    num home,
    PenaltiesDto? penalties,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfScoreDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfScoreDto.copyWith.fieldName(...)`
class _$ScoreDtoCWProxyImpl implements _$ScoreDtoCWProxy {
  const _$ScoreDtoCWProxyImpl(this._value);

  final ScoreDto _value;

  @override
  ScoreDto away(num away) => this(away: away);

  @override
  ScoreDto decidedBy(String? decidedBy) => this(decidedBy: decidedBy);

  @override
  ScoreDto home(num home) => this(home: home);

  @override
  ScoreDto penalties(PenaltiesDto? penalties) => this(penalties: penalties);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ScoreDto call({
    Object? away = const $CopyWithPlaceholder(),
    Object? decidedBy = const $CopyWithPlaceholder(),
    Object? home = const $CopyWithPlaceholder(),
    Object? penalties = const $CopyWithPlaceholder(),
  }) {
    return ScoreDto(
      away: away == const $CopyWithPlaceholder()
          ? _value.away
          // ignore: cast_nullable_to_non_nullable
          : away as num,
      decidedBy: decidedBy == const $CopyWithPlaceholder()
          ? _value.decidedBy
          // ignore: cast_nullable_to_non_nullable
          : decidedBy as String?,
      home: home == const $CopyWithPlaceholder()
          ? _value.home
          // ignore: cast_nullable_to_non_nullable
          : home as num,
      penalties: penalties == const $CopyWithPlaceholder()
          ? _value.penalties
          // ignore: cast_nullable_to_non_nullable
          : penalties as PenaltiesDto?,
    );
  }
}

extension $ScoreDtoCopyWith on ScoreDto {
  /// Returns a callable class that can be used as follows: `instanceOfScoreDto.copyWith(...)` or like so:`instanceOfScoreDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ScoreDtoCWProxy get copyWith => _$ScoreDtoCWProxyImpl(this);
}
