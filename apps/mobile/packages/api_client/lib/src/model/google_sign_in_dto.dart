//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/device_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'google_sign_in_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class GoogleSignInDto {
  /// Returns a new [GoogleSignInDto] instance.
  GoogleSignInDto({

     this.device,

    required  this.idToken,
  });

  @JsonKey(
    
    name: r'device',
    required: false,
    includeIfNull: false,
  )


  final DeviceDto? device;



  @JsonKey(
    
    name: r'idToken',
    required: true,
    includeIfNull: false,
  )


  final String idToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is GoogleSignInDto &&
      other.device == device &&
      other.idToken == idToken;

    @override
    int get hashCode =>
        device.hashCode +
        idToken.hashCode;

  factory GoogleSignInDto.fromJson(Map<String, dynamic> json) => _$GoogleSignInDtoFromJson(json);

  Map<String, dynamic> toJson() => _$GoogleSignInDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

