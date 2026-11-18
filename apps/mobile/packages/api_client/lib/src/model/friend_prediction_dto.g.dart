// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_prediction_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$FriendPredictionDtoCWProxy {
  FriendPredictionDto picks(List<PredictionPickDto> picks);

  FriendPredictionDto score(PredictionScoreDto? score);

  FriendPredictionDto status(FriendPredictionDtoStatusEnum status);

  FriendPredictionDto user(PublicUserDto user);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendPredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendPredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendPredictionDto call({
    List<PredictionPickDto> picks,
    PredictionScoreDto? score,
    FriendPredictionDtoStatusEnum status,
    PublicUserDto user,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfFriendPredictionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfFriendPredictionDto.copyWith.fieldName(...)`
class _$FriendPredictionDtoCWProxyImpl implements _$FriendPredictionDtoCWProxy {
  const _$FriendPredictionDtoCWProxyImpl(this._value);

  final FriendPredictionDto _value;

  @override
  FriendPredictionDto picks(List<PredictionPickDto> picks) =>
      this(picks: picks);

  @override
  FriendPredictionDto score(PredictionScoreDto? score) => this(score: score);

  @override
  FriendPredictionDto status(FriendPredictionDtoStatusEnum status) =>
      this(status: status);

  @override
  FriendPredictionDto user(PublicUserDto user) => this(user: user);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendPredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendPredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendPredictionDto call({
    Object? picks = const $CopyWithPlaceholder(),
    Object? score = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? user = const $CopyWithPlaceholder(),
  }) {
    return FriendPredictionDto(
      picks: picks == const $CopyWithPlaceholder()
          ? _value.picks
          // ignore: cast_nullable_to_non_nullable
          : picks as List<PredictionPickDto>,
      score: score == const $CopyWithPlaceholder()
          ? _value.score
          // ignore: cast_nullable_to_non_nullable
          : score as PredictionScoreDto?,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as FriendPredictionDtoStatusEnum,
      user: user == const $CopyWithPlaceholder()
          ? _value.user
          // ignore: cast_nullable_to_non_nullable
          : user as PublicUserDto,
    );
  }
}

extension $FriendPredictionDtoCopyWith on FriendPredictionDto {
  /// Returns a callable class that can be used as follows: `instanceOfFriendPredictionDto.copyWith(...)` or like so:`instanceOfFriendPredictionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$FriendPredictionDtoCWProxy get copyWith =>
      _$FriendPredictionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendPredictionDto _$FriendPredictionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendPredictionDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['picks', 'score', 'status', 'user'],
      );
      final val = FriendPredictionDto(
        picks: $checkedConvert(
          'picks',
          (v) => (v as List<dynamic>)
              .map((e) => PredictionPickDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        score: $checkedConvert(
          'score',
          (v) => v == null
              ? null
              : PredictionScoreDto.fromJson(v as Map<String, dynamic>),
        ),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$FriendPredictionDtoStatusEnumEnumMap,
            v,
            unknownValue: FriendPredictionDtoStatusEnum.unknownDefaultOpenApi,
          ),
        ),
        user: $checkedConvert(
          'user',
          (v) => PublicUserDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendPredictionDtoToJson(
  FriendPredictionDto instance,
) => <String, dynamic>{
  'picks': instance.picks.map((e) => e.toJson()).toList(),
  'score': instance.score?.toJson(),
  'status': _$FriendPredictionDtoStatusEnumEnumMap[instance.status]!,
  'user': instance.user.toJson(),
};

const _$FriendPredictionDtoStatusEnumEnumMap = {
  FriendPredictionDtoStatusEnum.ACTIVE: 'ACTIVE',
  FriendPredictionDtoStatusEnum.VOID: 'VOID',
  FriendPredictionDtoStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
