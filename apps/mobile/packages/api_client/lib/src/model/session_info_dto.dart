//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'session_info_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SessionInfoDto {
  /// Returns a new [SessionInfoDto] instance.
  SessionInfoDto({

    required  this.createdAt,

    required  this.current,

     this.deviceName,

    required  this.id,

    required  this.lastUsedAt,

     this.platform,
  });

  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final String createdAt;



  @JsonKey(
    
    name: r'current',
    required: true,
    includeIfNull: false,
  )


  final bool current;



  @JsonKey(
    
    name: r'deviceName',
    required: false,
    includeIfNull: false,
  )


  final String? deviceName;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'lastUsedAt',
    required: true,
    includeIfNull: false,
  )


  final String lastUsedAt;



  @JsonKey(
    
    name: r'platform',
    required: false,
    includeIfNull: false,
  )


  final String? platform;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SessionInfoDto &&
      other.createdAt == createdAt &&
      other.current == current &&
      other.deviceName == deviceName &&
      other.id == id &&
      other.lastUsedAt == lastUsedAt &&
      other.platform == platform;

    @override
    int get hashCode =>
        createdAt.hashCode +
        current.hashCode +
        deviceName.hashCode +
        id.hashCode +
        lastUsedAt.hashCode +
        platform.hashCode;

  factory SessionInfoDto.fromJson(Map<String, dynamic> json) => _$SessionInfoDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SessionInfoDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

