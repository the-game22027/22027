// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'report_question_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReportQuestionDtoCWProxy {
  ReportQuestionDto reason(String reason);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReportQuestionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReportQuestionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReportQuestionDto call({String reason});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReportQuestionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReportQuestionDto.copyWith.fieldName(...)`
class _$ReportQuestionDtoCWProxyImpl implements _$ReportQuestionDtoCWProxy {
  const _$ReportQuestionDtoCWProxyImpl(this._value);

  final ReportQuestionDto _value;

  @override
  ReportQuestionDto reason(String reason) => this(reason: reason);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReportQuestionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReportQuestionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReportQuestionDto call({Object? reason = const $CopyWithPlaceholder()}) {
    return ReportQuestionDto(
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as String,
    );
  }
}

extension $ReportQuestionDtoCopyWith on ReportQuestionDto {
  /// Returns a callable class that can be used as follows: `instanceOfReportQuestionDto.copyWith(...)` or like so:`instanceOfReportQuestionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReportQuestionDtoCWProxy get copyWith =>
      _$ReportQuestionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReportQuestionDto _$ReportQuestionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReportQuestionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['reason']);
      final val = ReportQuestionDto(
        reason: $checkedConvert('reason', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ReportQuestionDtoToJson(ReportQuestionDto instance) =>
    <String, dynamic>{'reason': instance.reason};
