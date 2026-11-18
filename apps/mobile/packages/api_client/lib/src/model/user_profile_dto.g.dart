// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_profile_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UserProfileDtoCWProxy {
  UserProfileDto avatarUrl(String? avatarUrl);

  UserProfileDto displayName(String displayName);

  UserProfileDto id(String id);

  UserProfileDto relationship(UserProfileDtoRelationshipEnum relationship);

  UserProfileDto requestId(String? requestId);

  UserProfileDto username(String? username);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserProfileDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserProfileDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserProfileDto call({
    String? avatarUrl,
    String displayName,
    String id,
    UserProfileDtoRelationshipEnum relationship,
    String? requestId,
    String? username,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUserProfileDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUserProfileDto.copyWith.fieldName(...)`
class _$UserProfileDtoCWProxyImpl implements _$UserProfileDtoCWProxy {
  const _$UserProfileDtoCWProxyImpl(this._value);

  final UserProfileDto _value;

  @override
  UserProfileDto avatarUrl(String? avatarUrl) => this(avatarUrl: avatarUrl);

  @override
  UserProfileDto displayName(String displayName) =>
      this(displayName: displayName);

  @override
  UserProfileDto id(String id) => this(id: id);

  @override
  UserProfileDto relationship(UserProfileDtoRelationshipEnum relationship) =>
      this(relationship: relationship);

  @override
  UserProfileDto requestId(String? requestId) => this(requestId: requestId);

  @override
  UserProfileDto username(String? username) => this(username: username);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserProfileDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserProfileDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserProfileDto call({
    Object? avatarUrl = const $CopyWithPlaceholder(),
    Object? displayName = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? relationship = const $CopyWithPlaceholder(),
    Object? requestId = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
  }) {
    return UserProfileDto(
      avatarUrl: avatarUrl == const $CopyWithPlaceholder()
          ? _value.avatarUrl
          // ignore: cast_nullable_to_non_nullable
          : avatarUrl as String?,
      displayName: displayName == const $CopyWithPlaceholder()
          ? _value.displayName
          // ignore: cast_nullable_to_non_nullable
          : displayName as String,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      relationship: relationship == const $CopyWithPlaceholder()
          ? _value.relationship
          // ignore: cast_nullable_to_non_nullable
          : relationship as UserProfileDtoRelationshipEnum,
      requestId: requestId == const $CopyWithPlaceholder()
          ? _value.requestId
          // ignore: cast_nullable_to_non_nullable
          : requestId as String?,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String?,
    );
  }
}

extension $UserProfileDtoCopyWith on UserProfileDto {
  /// Returns a callable class that can be used as follows: `instanceOfUserProfileDto.copyWith(...)` or like so:`instanceOfUserProfileDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UserProfileDtoCWProxy get copyWith => _$UserProfileDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserProfileDto _$UserProfileDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UserProfileDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'avatarUrl',
          'displayName',
          'id',
          'relationship',
          'requestId',
          'username',
        ],
      );
      final val = UserProfileDto(
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
        displayName: $checkedConvert('displayName', (v) => v as String),
        id: $checkedConvert('id', (v) => v as String),
        relationship: $checkedConvert(
          'relationship',
          (v) => $enumDecode(
            _$UserProfileDtoRelationshipEnumEnumMap,
            v,
            unknownValue: UserProfileDtoRelationshipEnum.unknownDefaultOpenApi,
          ),
        ),
        requestId: $checkedConvert('requestId', (v) => v as String?),
        username: $checkedConvert('username', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$UserProfileDtoToJson(UserProfileDto instance) =>
    <String, dynamic>{
      'avatarUrl': instance.avatarUrl,
      'displayName': instance.displayName,
      'id': instance.id,
      'relationship':
          _$UserProfileDtoRelationshipEnumEnumMap[instance.relationship]!,
      'requestId': instance.requestId,
      'username': instance.username,
    };

const _$UserProfileDtoRelationshipEnumEnumMap = {
  UserProfileDtoRelationshipEnum.SELF: 'SELF',
  UserProfileDtoRelationshipEnum.NONE: 'NONE',
  UserProfileDtoRelationshipEnum.FRIENDS: 'FRIENDS',
  UserProfileDtoRelationshipEnum.REQUEST_SENT: 'REQUEST_SENT',
  UserProfileDtoRelationshipEnum.REQUEST_RECEIVED: 'REQUEST_RECEIVED',
  UserProfileDtoRelationshipEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
