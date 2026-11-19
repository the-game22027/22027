// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'matchmaking_ticket_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MatchmakingTicketDtoCWProxy {
  MatchmakingTicketDto botFallbackAt(String? botFallbackAt);

  MatchmakingTicketDto gameType(MatchmakingTicketDtoGameTypeEnum gameType);

  MatchmakingTicketDto queuedAt(String queuedAt);

  MatchmakingTicketDto status(MatchmakingTicketDtoStatusEnum status);

  MatchmakingTicketDto ticketId(String ticketId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchmakingTicketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchmakingTicketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchmakingTicketDto call({
    String? botFallbackAt,
    MatchmakingTicketDtoGameTypeEnum gameType,
    String queuedAt,
    MatchmakingTicketDtoStatusEnum status,
    String ticketId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMatchmakingTicketDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMatchmakingTicketDto.copyWith.fieldName(...)`
class _$MatchmakingTicketDtoCWProxyImpl
    implements _$MatchmakingTicketDtoCWProxy {
  const _$MatchmakingTicketDtoCWProxyImpl(this._value);

  final MatchmakingTicketDto _value;

  @override
  MatchmakingTicketDto botFallbackAt(String? botFallbackAt) =>
      this(botFallbackAt: botFallbackAt);

  @override
  MatchmakingTicketDto gameType(MatchmakingTicketDtoGameTypeEnum gameType) =>
      this(gameType: gameType);

  @override
  MatchmakingTicketDto queuedAt(String queuedAt) => this(queuedAt: queuedAt);

  @override
  MatchmakingTicketDto status(MatchmakingTicketDtoStatusEnum status) =>
      this(status: status);

  @override
  MatchmakingTicketDto ticketId(String ticketId) => this(ticketId: ticketId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchmakingTicketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchmakingTicketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchmakingTicketDto call({
    Object? botFallbackAt = const $CopyWithPlaceholder(),
    Object? gameType = const $CopyWithPlaceholder(),
    Object? queuedAt = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? ticketId = const $CopyWithPlaceholder(),
  }) {
    return MatchmakingTicketDto(
      botFallbackAt: botFallbackAt == const $CopyWithPlaceholder()
          ? _value.botFallbackAt
          // ignore: cast_nullable_to_non_nullable
          : botFallbackAt as String?,
      gameType: gameType == const $CopyWithPlaceholder()
          ? _value.gameType
          // ignore: cast_nullable_to_non_nullable
          : gameType as MatchmakingTicketDtoGameTypeEnum,
      queuedAt: queuedAt == const $CopyWithPlaceholder()
          ? _value.queuedAt
          // ignore: cast_nullable_to_non_nullable
          : queuedAt as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as MatchmakingTicketDtoStatusEnum,
      ticketId: ticketId == const $CopyWithPlaceholder()
          ? _value.ticketId
          // ignore: cast_nullable_to_non_nullable
          : ticketId as String,
    );
  }
}

extension $MatchmakingTicketDtoCopyWith on MatchmakingTicketDto {
  /// Returns a callable class that can be used as follows: `instanceOfMatchmakingTicketDto.copyWith(...)` or like so:`instanceOfMatchmakingTicketDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MatchmakingTicketDtoCWProxy get copyWith =>
      _$MatchmakingTicketDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MatchmakingTicketDto _$MatchmakingTicketDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('MatchmakingTicketDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'botFallbackAt',
      'gameType',
      'queuedAt',
      'status',
      'ticketId',
    ],
  );
  final val = MatchmakingTicketDto(
    botFallbackAt: $checkedConvert('botFallbackAt', (v) => v as String?),
    gameType: $checkedConvert(
      'gameType',
      (v) => $enumDecode(
        _$MatchmakingTicketDtoGameTypeEnumEnumMap,
        v,
        unknownValue: MatchmakingTicketDtoGameTypeEnum.unknownDefaultOpenApi,
      ),
    ),
    queuedAt: $checkedConvert('queuedAt', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$MatchmakingTicketDtoStatusEnumEnumMap,
        v,
        unknownValue: MatchmakingTicketDtoStatusEnum.unknownDefaultOpenApi,
      ),
    ),
    ticketId: $checkedConvert('ticketId', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$MatchmakingTicketDtoToJson(
  MatchmakingTicketDto instance,
) => <String, dynamic>{
  'botFallbackAt': instance.botFallbackAt,
  'gameType': _$MatchmakingTicketDtoGameTypeEnumEnumMap[instance.gameType]!,
  'queuedAt': instance.queuedAt,
  'status': _$MatchmakingTicketDtoStatusEnumEnumMap[instance.status]!,
  'ticketId': instance.ticketId,
};

const _$MatchmakingTicketDtoGameTypeEnumEnumMap = {
  MatchmakingTicketDtoGameTypeEnum.BUZZER: 'BUZZER',
  MatchmakingTicketDtoGameTypeEnum.CAREER: 'CAREER',
  MatchmakingTicketDtoGameTypeEnum.WHO_IS_PLAYER: 'WHO_IS_PLAYER',
  MatchmakingTicketDtoGameTypeEnum.GRID: 'GRID',
  MatchmakingTicketDtoGameTypeEnum.MINES: 'MINES',
  MatchmakingTicketDtoGameTypeEnum.AUCTION: 'AUCTION',
  MatchmakingTicketDtoGameTypeEnum.VAULT: 'VAULT',
  MatchmakingTicketDtoGameTypeEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

const _$MatchmakingTicketDtoStatusEnumEnumMap = {
  MatchmakingTicketDtoStatusEnum.QUEUED: 'QUEUED',
  MatchmakingTicketDtoStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
