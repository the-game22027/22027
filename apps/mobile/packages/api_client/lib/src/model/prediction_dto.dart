//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/prediction_pick_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'prediction_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PredictionDto {
  /// Returns a new [PredictionDto] instance.
  PredictionDto({

    required  this.id,

    required  this.locked,

    required  this.matchId,

    required  this.picks,

    required  this.revision,

    required  this.status,

    required  this.updatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'locked',
    required: true,
    includeIfNull: false,
  )


  final bool locked;



  @JsonKey(
    
    name: r'matchId',
    required: true,
    includeIfNull: false,
  )


  final String matchId;



  @JsonKey(
    
    name: r'picks',
    required: true,
    includeIfNull: false,
  )


  final List<PredictionPickDto> picks;



  @JsonKey(
    
    name: r'revision',
    required: true,
    includeIfNull: false,
  )


  final num revision;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PredictionDtoStatusEnum.unknownDefaultOpenApi,
  )


  final PredictionDtoStatusEnum status;



  @JsonKey(
    
    name: r'updatedAt',
    required: true,
    includeIfNull: false,
  )


  final String updatedAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PredictionDto &&
      other.id == id &&
      other.locked == locked &&
      other.matchId == matchId &&
      other.picks == picks &&
      other.revision == revision &&
      other.status == status &&
      other.updatedAt == updatedAt;

    @override
    int get hashCode =>
        id.hashCode +
        locked.hashCode +
        matchId.hashCode +
        picks.hashCode +
        revision.hashCode +
        status.hashCode +
        updatedAt.hashCode;

  factory PredictionDto.fromJson(Map<String, dynamic> json) => _$PredictionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PredictionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PredictionDtoStatusEnum {
@JsonValue(r'ACTIVE')
ACTIVE(r'ACTIVE'),
@JsonValue(r'VOID')
VOID(r'VOID'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PredictionDtoStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


