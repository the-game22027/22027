//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'identity_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class IdentityDto {
  /// Returns a new [IdentityDto] instance.
  IdentityDto({

    required  this.id,

    required  this.label,

    required  this.provider,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'provider',
    required: true,
    includeIfNull: false,
  unknownEnumValue: IdentityDtoProviderEnum.unknownDefaultOpenApi,
  )


  final IdentityDtoProviderEnum provider;





    @override
    bool operator ==(Object other) => identical(this, other) || other is IdentityDto &&
      other.id == id &&
      other.label == label &&
      other.provider == provider;

    @override
    int get hashCode =>
        id.hashCode +
        label.hashCode +
        provider.hashCode;

  factory IdentityDto.fromJson(Map<String, dynamic> json) => _$IdentityDtoFromJson(json);

  Map<String, dynamic> toJson() => _$IdentityDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum IdentityDtoProviderEnum {
@JsonValue(r'GOOGLE')
GOOGLE(r'GOOGLE'),
@JsonValue(r'FACEBOOK')
FACEBOOK(r'FACEBOOK'),
@JsonValue(r'X')
X(r'X'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const IdentityDtoProviderEnum(this.value);

final String value;

@override
String toString() => value;
}


