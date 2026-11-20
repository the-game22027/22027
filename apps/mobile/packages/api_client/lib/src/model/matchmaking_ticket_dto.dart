//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'matchmaking_ticket_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MatchmakingTicketDto {
  /// Returns a new [MatchmakingTicketDto] instance.
  MatchmakingTicketDto({
    required this.botFallbackAt,

    required this.gameType,

    required this.queuedAt,

    required this.status,

    required this.ticketId,
  });

  @JsonKey(name: r'botFallbackAt', required: true, includeIfNull: true)
  final String? botFallbackAt;

  @JsonKey(
    name: r'gameType',
    required: true,
    includeIfNull: false,
    unknownEnumValue: MatchmakingTicketDtoGameTypeEnum.unknownDefaultOpenApi,
  )
  final MatchmakingTicketDtoGameTypeEnum gameType;

  @JsonKey(name: r'queuedAt', required: true, includeIfNull: false)
  final String queuedAt;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: MatchmakingTicketDtoStatusEnum.unknownDefaultOpenApi,
  )
  final MatchmakingTicketDtoStatusEnum status;

  @JsonKey(name: r'ticketId', required: true, includeIfNull: false)
  final String ticketId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MatchmakingTicketDto &&
          other.botFallbackAt == botFallbackAt &&
          other.gameType == gameType &&
          other.queuedAt == queuedAt &&
          other.status == status &&
          other.ticketId == ticketId;

  @override
  int get hashCode =>
      (botFallbackAt == null ? 0 : botFallbackAt.hashCode) +
      gameType.hashCode +
      queuedAt.hashCode +
      status.hashCode +
      ticketId.hashCode;

  factory MatchmakingTicketDto.fromJson(Map<String, dynamic> json) =>
      _$MatchmakingTicketDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MatchmakingTicketDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum MatchmakingTicketDtoGameTypeEnum {
  @JsonValue(r'BUZZER')
  BUZZER(r'BUZZER'),
  @JsonValue(r'CAREER')
  CAREER(r'CAREER'),
  @JsonValue(r'WHO_IS_PLAYER')
  WHO_IS_PLAYER(r'WHO_IS_PLAYER'),
  @JsonValue(r'GRID')
  GRID(r'GRID'),
  @JsonValue(r'MINES')
  MINES(r'MINES'),
  @JsonValue(r'AUCTION')
  AUCTION(r'AUCTION'),
  @JsonValue(r'VAULT')
  VAULT(r'VAULT'),
  @JsonValue(r'HEX')
  HEX(r'HEX'),
  @JsonValue(r'LINEUP')
  LINEUP(r'LINEUP'),
  @JsonValue(r'ONE_TWO')
  ONE_TWO(r'ONE_TWO'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const MatchmakingTicketDtoGameTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum MatchmakingTicketDtoStatusEnum {
  @JsonValue(r'QUEUED')
  QUEUED(r'QUEUED'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const MatchmakingTicketDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
