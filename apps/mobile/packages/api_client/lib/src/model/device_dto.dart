//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'device_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DeviceDto {
  /// Returns a new [DeviceDto] instance.
  DeviceDto({this.name, this.platform});

  @JsonKey(name: r'name', required: false, includeIfNull: false)
  final String? name;

  @JsonKey(
    name: r'platform',
    required: false,
    includeIfNull: false,
    unknownEnumValue: DeviceDtoPlatformEnum.unknownDefaultOpenApi,
  )
  final DeviceDtoPlatformEnum? platform;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DeviceDto && other.name == name && other.platform == platform;

  @override
  int get hashCode => name.hashCode + platform.hashCode;

  factory DeviceDto.fromJson(Map<String, dynamic> json) =>
      _$DeviceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DeviceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum DeviceDtoPlatformEnum {
  @JsonValue(r'ios')
  ios(r'ios'),
  @JsonValue(r'android')
  android(r'android'),
  @JsonValue(r'web')
  web(r'web'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DeviceDtoPlatformEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
