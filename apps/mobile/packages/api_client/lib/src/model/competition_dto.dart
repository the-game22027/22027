//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'competition_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CompetitionDto {
  /// Returns a new [CompetitionDto] instance.
  CompetitionDto({

    required  this.code,

    required  this.countryCode,

    required  this.id,

    required  this.isNationalTeams,

    required  this.name,

    required  this.type,
  });

  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;



  @JsonKey(
    
    name: r'countryCode',
    required: true,
    includeIfNull: true,
  )


  final String? countryCode;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'isNationalTeams',
    required: true,
    includeIfNull: false,
  )


  final bool isNationalTeams;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final String type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CompetitionDto &&
      other.code == code &&
      other.countryCode == countryCode &&
      other.id == id &&
      other.isNationalTeams == isNationalTeams &&
      other.name == name &&
      other.type == type;

    @override
    int get hashCode =>
        code.hashCode +
        (countryCode == null ? 0 : countryCode.hashCode) +
        id.hashCode +
        isNationalTeams.hashCode +
        name.hashCode +
        type.hashCode;

  factory CompetitionDto.fromJson(Map<String, dynamic> json) => _$CompetitionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CompetitionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

