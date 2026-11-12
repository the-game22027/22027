// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'match_summary_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MatchSummaryDtoCWProxy {
  MatchSummaryDto awayTeam(TeamDto awayTeam);

  MatchSummaryDto competition(MatchCompetitionDto competition);

  MatchSummaryDto homeTeam(TeamDto homeTeam);

  MatchSummaryDto id(String id);

  MatchSummaryDto kickoffAt(String kickoffAt);

  MatchSummaryDto predictable(bool predictable);

  MatchSummaryDto roundLabel(String? roundLabel);

  MatchSummaryDto score(ScoreDto? score);

  MatchSummaryDto status(MatchSummaryDtoStatusEnum status);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchSummaryDto call({
    TeamDto awayTeam,
    MatchCompetitionDto competition,
    TeamDto homeTeam,
    String id,
    String kickoffAt,
    bool predictable,
    String? roundLabel,
    ScoreDto? score,
    MatchSummaryDtoStatusEnum status,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMatchSummaryDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMatchSummaryDto.copyWith.fieldName(...)`
class _$MatchSummaryDtoCWProxyImpl implements _$MatchSummaryDtoCWProxy {
  const _$MatchSummaryDtoCWProxyImpl(this._value);

  final MatchSummaryDto _value;

  @override
  MatchSummaryDto awayTeam(TeamDto awayTeam) => this(awayTeam: awayTeam);

  @override
  MatchSummaryDto competition(MatchCompetitionDto competition) =>
      this(competition: competition);

  @override
  MatchSummaryDto homeTeam(TeamDto homeTeam) => this(homeTeam: homeTeam);

  @override
  MatchSummaryDto id(String id) => this(id: id);

  @override
  MatchSummaryDto kickoffAt(String kickoffAt) => this(kickoffAt: kickoffAt);

  @override
  MatchSummaryDto predictable(bool predictable) =>
      this(predictable: predictable);

  @override
  MatchSummaryDto roundLabel(String? roundLabel) =>
      this(roundLabel: roundLabel);

  @override
  MatchSummaryDto score(ScoreDto? score) => this(score: score);

  @override
  MatchSummaryDto status(MatchSummaryDtoStatusEnum status) =>
      this(status: status);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchSummaryDto call({
    Object? awayTeam = const $CopyWithPlaceholder(),
    Object? competition = const $CopyWithPlaceholder(),
    Object? homeTeam = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? kickoffAt = const $CopyWithPlaceholder(),
    Object? predictable = const $CopyWithPlaceholder(),
    Object? roundLabel = const $CopyWithPlaceholder(),
    Object? score = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
  }) {
    return MatchSummaryDto(
      awayTeam: awayTeam == const $CopyWithPlaceholder()
          ? _value.awayTeam
          // ignore: cast_nullable_to_non_nullable
          : awayTeam as TeamDto,
      competition: competition == const $CopyWithPlaceholder()
          ? _value.competition
          // ignore: cast_nullable_to_non_nullable
          : competition as MatchCompetitionDto,
      homeTeam: homeTeam == const $CopyWithPlaceholder()
          ? _value.homeTeam
          // ignore: cast_nullable_to_non_nullable
          : homeTeam as TeamDto,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      kickoffAt: kickoffAt == const $CopyWithPlaceholder()
          ? _value.kickoffAt
          // ignore: cast_nullable_to_non_nullable
          : kickoffAt as String,
      predictable: predictable == const $CopyWithPlaceholder()
          ? _value.predictable
          // ignore: cast_nullable_to_non_nullable
          : predictable as bool,
      roundLabel: roundLabel == const $CopyWithPlaceholder()
          ? _value.roundLabel
          // ignore: cast_nullable_to_non_nullable
          : roundLabel as String?,
      score: score == const $CopyWithPlaceholder()
          ? _value.score
          // ignore: cast_nullable_to_non_nullable
          : score as ScoreDto?,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as MatchSummaryDtoStatusEnum,
    );
  }
}

extension $MatchSummaryDtoCopyWith on MatchSummaryDto {
  /// Returns a callable class that can be used as follows: `instanceOfMatchSummaryDto.copyWith(...)` or like so:`instanceOfMatchSummaryDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MatchSummaryDtoCWProxy get copyWith => _$MatchSummaryDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MatchSummaryDto _$MatchSummaryDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MatchSummaryDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'awayTeam',
          'competition',
          'homeTeam',
          'id',
          'kickoffAt',
          'predictable',
          'roundLabel',
          'score',
          'status',
        ],
      );
      final val = MatchSummaryDto(
        awayTeam: $checkedConvert(
          'awayTeam',
          (v) => TeamDto.fromJson(v as Map<String, dynamic>),
        ),
        competition: $checkedConvert(
          'competition',
          (v) => MatchCompetitionDto.fromJson(v as Map<String, dynamic>),
        ),
        homeTeam: $checkedConvert(
          'homeTeam',
          (v) => TeamDto.fromJson(v as Map<String, dynamic>),
        ),
        id: $checkedConvert('id', (v) => v as String),
        kickoffAt: $checkedConvert('kickoffAt', (v) => v as String),
        predictable: $checkedConvert('predictable', (v) => v as bool),
        roundLabel: $checkedConvert('roundLabel', (v) => v as String?),
        score: $checkedConvert(
          'score',
          (v) =>
              v == null ? null : ScoreDto.fromJson(v as Map<String, dynamic>),
        ),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$MatchSummaryDtoStatusEnumEnumMap,
            v,
            unknownValue: MatchSummaryDtoStatusEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MatchSummaryDtoToJson(MatchSummaryDto instance) =>
    <String, dynamic>{
      'awayTeam': instance.awayTeam.toJson(),
      'competition': instance.competition.toJson(),
      'homeTeam': instance.homeTeam.toJson(),
      'id': instance.id,
      'kickoffAt': instance.kickoffAt,
      'predictable': instance.predictable,
      'roundLabel': instance.roundLabel,
      'score': instance.score?.toJson(),
      'status': _$MatchSummaryDtoStatusEnumEnumMap[instance.status]!,
    };

const _$MatchSummaryDtoStatusEnumEnumMap = {
  MatchSummaryDtoStatusEnum.CANCELLED: 'CANCELLED',
  MatchSummaryDtoStatusEnum.SCHEDULED: 'SCHEDULED',
  MatchSummaryDtoStatusEnum.FINISHED: 'FINISHED',
  MatchSummaryDtoStatusEnum.ABANDONED: 'ABANDONED',
  MatchSummaryDtoStatusEnum.LIVE: 'LIVE',
  MatchSummaryDtoStatusEnum.POSTPONED: 'POSTPONED',
  MatchSummaryDtoStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
