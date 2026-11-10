//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'prediction_pick_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PredictionPickDto {
  /// Returns a new [PredictionPickDto] instance.
  PredictionPickDto({

     this.away,

     this.home,

     this.outcome,

    required  this.type,
  });

  @JsonKey(
    
    name: r'away',
    required: false,
    includeIfNull: false,
  )


  final num? away;



  @JsonKey(
    
    name: r'home',
    required: false,
    includeIfNull: false,
  )


  final num? home;



  @JsonKey(
    
    name: r'outcome',
    required: false,
    includeIfNull: false,
  unknownEnumValue: PredictionPickDtoOutcomeEnum.unknownDefaultOpenApi,
  )


  final PredictionPickDtoOutcomeEnum? outcome;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PredictionPickDtoTypeEnum.unknownDefaultOpenApi,
  )


  final PredictionPickDtoTypeEnum type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PredictionPickDto &&
      other.away == away &&
      other.home == home &&
      other.outcome == outcome &&
      other.type == type;

    @override
    int get hashCode =>
        away.hashCode +
        home.hashCode +
        outcome.hashCode +
        type.hashCode;

  factory PredictionPickDto.fromJson(Map<String, dynamic> json) => _$PredictionPickDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PredictionPickDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PredictionPickDtoOutcomeEnum {
@JsonValue(r'HOME')
HOME(r'HOME'),
@JsonValue(r'DRAW')
DRAW(r'DRAW'),
@JsonValue(r'AWAY')
AWAY(r'AWAY'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PredictionPickDtoOutcomeEnum(this.value);

final String value;

@override
String toString() => value;
}


enum PredictionPickDtoTypeEnum {
@JsonValue(r'EXACT_SCORE')
EXACT_SCORE(r'EXACT_SCORE'),
@JsonValue(r'RESULT')
RESULT(r'RESULT'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PredictionPickDtoTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


