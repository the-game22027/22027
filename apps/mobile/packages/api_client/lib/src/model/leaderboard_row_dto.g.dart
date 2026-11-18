// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leaderboard_row_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LeaderboardRowDtoCWProxy {
  LeaderboardRowDto isMe(bool isMe);

  LeaderboardRowDto points(num points);

  LeaderboardRowDto rank(num rank);

  LeaderboardRowDto user(PublicUserDto user);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardRowDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardRowDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardRowDto call({bool isMe, num points, num rank, PublicUserDto user});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLeaderboardRowDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLeaderboardRowDto.copyWith.fieldName(...)`
class _$LeaderboardRowDtoCWProxyImpl implements _$LeaderboardRowDtoCWProxy {
  const _$LeaderboardRowDtoCWProxyImpl(this._value);

  final LeaderboardRowDto _value;

  @override
  LeaderboardRowDto isMe(bool isMe) => this(isMe: isMe);

  @override
  LeaderboardRowDto points(num points) => this(points: points);

  @override
  LeaderboardRowDto rank(num rank) => this(rank: rank);

  @override
  LeaderboardRowDto user(PublicUserDto user) => this(user: user);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LeaderboardRowDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LeaderboardRowDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LeaderboardRowDto call({
    Object? isMe = const $CopyWithPlaceholder(),
    Object? points = const $CopyWithPlaceholder(),
    Object? rank = const $CopyWithPlaceholder(),
    Object? user = const $CopyWithPlaceholder(),
  }) {
    return LeaderboardRowDto(
      isMe: isMe == const $CopyWithPlaceholder()
          ? _value.isMe
          // ignore: cast_nullable_to_non_nullable
          : isMe as bool,
      points: points == const $CopyWithPlaceholder()
          ? _value.points
          // ignore: cast_nullable_to_non_nullable
          : points as num,
      rank: rank == const $CopyWithPlaceholder()
          ? _value.rank
          // ignore: cast_nullable_to_non_nullable
          : rank as num,
      user: user == const $CopyWithPlaceholder()
          ? _value.user
          // ignore: cast_nullable_to_non_nullable
          : user as PublicUserDto,
    );
  }
}

extension $LeaderboardRowDtoCopyWith on LeaderboardRowDto {
  /// Returns a callable class that can be used as follows: `instanceOfLeaderboardRowDto.copyWith(...)` or like so:`instanceOfLeaderboardRowDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LeaderboardRowDtoCWProxy get copyWith =>
      _$LeaderboardRowDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LeaderboardRowDto _$LeaderboardRowDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LeaderboardRowDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['isMe', 'points', 'rank', 'user']);
      final val = LeaderboardRowDto(
        isMe: $checkedConvert('isMe', (v) => v as bool),
        points: $checkedConvert('points', (v) => v as num),
        rank: $checkedConvert('rank', (v) => v as num),
        user: $checkedConvert(
          'user',
          (v) => PublicUserDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LeaderboardRowDtoToJson(LeaderboardRowDto instance) =>
    <String, dynamic>{
      'isMe': instance.isMe,
      'points': instance.points,
      'rank': instance.rank,
      'user': instance.user.toJson(),
    };
