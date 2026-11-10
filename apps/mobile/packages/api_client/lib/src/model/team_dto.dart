//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'team_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TeamDto {
  /// Returns a new [TeamDto] instance.
  TeamDto({

    required  this.crestUrl,

    required  this.id,

    required  this.name,

     this.shortName,

    required  this.type,
  });

  @JsonKey(
    
    name: r'crestUrl',
    required: true,
    includeIfNull: true,
  )


  final String? crestUrl;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'shortName',
    required: false,
    includeIfNull: false,
  )


  final String? shortName;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final String type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TeamDto &&
      other.crestUrl == crestUrl &&
      other.id == id &&
      other.name == name &&
      other.shortName == shortName &&
      other.type == type;

    @override
    int get hashCode =>
        (crestUrl == null ? 0 : crestUrl.hashCode) +
        id.hashCode +
        name.hashCode +
        shortName.hashCode +
        type.hashCode;

  factory TeamDto.fromJson(Map<String, dynamic> json) => _$TeamDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TeamDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

