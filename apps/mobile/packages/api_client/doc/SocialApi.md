# api_client.api.SocialApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**friendRequestsControllerAcceptV1**](SocialApi.md#friendrequestscontrolleracceptv1) | **POST** /v1/friend-requests/{requestId}/accept | 
[**friendRequestsControllerCancelV1**](SocialApi.md#friendrequestscontrollercancelv1) | **DELETE** /v1/friend-requests/{requestId} | 
[**friendRequestsControllerDeclineV1**](SocialApi.md#friendrequestscontrollerdeclinev1) | **POST** /v1/friend-requests/{requestId}/decline | 
[**friendRequestsControllerListV1**](SocialApi.md#friendrequestscontrollerlistv1) | **GET** /v1/friend-requests | 
[**friendRequestsControllerSendV1**](SocialApi.md#friendrequestscontrollersendv1) | **POST** /v1/friend-requests | 201 for a new request; 200 with the same request when it was already pending (03 §7.1).
[**myConnectionsControllerBlockV1**](SocialApi.md#myconnectionscontrollerblockv1) | **PUT** /v1/me/blocks/{userId} | 
[**myConnectionsControllerBlocksV1**](SocialApi.md#myconnectionscontrollerblocksv1) | **GET** /v1/me/blocks | 
[**myConnectionsControllerFriendsV1**](SocialApi.md#myconnectionscontrollerfriendsv1) | **GET** /v1/me/friends | 
[**myConnectionsControllerUnblockV1**](SocialApi.md#myconnectionscontrollerunblockv1) | **DELETE** /v1/me/blocks/{userId} | 
[**myConnectionsControllerUnfriendV1**](SocialApi.md#myconnectionscontrollerunfriendv1) | **DELETE** /v1/me/friends/{userId} | 
[**userDirectoryControllerProfileV1**](SocialApi.md#userdirectorycontrollerprofilev1) | **GET** /v1/users/{userId} | 
[**userDirectoryControllerSearchV1**](SocialApi.md#userdirectorycontrollersearchv1) | **GET** /v1/users | 


# **friendRequestsControllerAcceptV1**
> FriendRequestDto friendRequestsControllerAcceptV1(requestId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String requestId = requestId_example; // String | 

try {
    final response = api.friendRequestsControllerAcceptV1(requestId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->friendRequestsControllerAcceptV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **requestId** | **String**|  | 

### Return type

[**FriendRequestDto**](FriendRequestDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **friendRequestsControllerCancelV1**
> friendRequestsControllerCancelV1(requestId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String requestId = requestId_example; // String | 

try {
    api.friendRequestsControllerCancelV1(requestId);
} on DioException catch (e) {
    print('Exception when calling SocialApi->friendRequestsControllerCancelV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **requestId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **friendRequestsControllerDeclineV1**
> FriendRequestDto friendRequestsControllerDeclineV1(requestId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String requestId = requestId_example; // String | 

try {
    final response = api.friendRequestsControllerDeclineV1(requestId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->friendRequestsControllerDeclineV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **requestId** | **String**|  | 

### Return type

[**FriendRequestDto**](FriendRequestDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **friendRequestsControllerListV1**
> FriendRequestPageDto friendRequestsControllerListV1(direction, limit, cursor)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String direction = direction_example; // String | 
final num limit = 8.14; // num | 
final String cursor = cursor_example; // String | 

try {
    final response = api.friendRequestsControllerListV1(direction, limit, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->friendRequestsControllerListV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **direction** | **String**|  | 
 **limit** | **num**|  | [optional] 
 **cursor** | **String**|  | [optional] 

### Return type

[**FriendRequestPageDto**](FriendRequestPageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **friendRequestsControllerSendV1**
> FriendRequestDto friendRequestsControllerSendV1(sendFriendRequestDto)

201 for a new request; 200 with the same request when it was already pending (03 §7.1).

### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final SendFriendRequestDto sendFriendRequestDto = ; // SendFriendRequestDto | 

try {
    final response = api.friendRequestsControllerSendV1(sendFriendRequestDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->friendRequestsControllerSendV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sendFriendRequestDto** | [**SendFriendRequestDto**](SendFriendRequestDto.md)|  | 

### Return type

[**FriendRequestDto**](FriendRequestDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myConnectionsControllerBlockV1**
> myConnectionsControllerBlockV1(userId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String userId = userId_example; // String | 

try {
    api.myConnectionsControllerBlockV1(userId);
} on DioException catch (e) {
    print('Exception when calling SocialApi->myConnectionsControllerBlockV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myConnectionsControllerBlocksV1**
> ConnectedUserPageDto myConnectionsControllerBlocksV1(limit, cursor)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final num limit = 8.14; // num | 
final String cursor = cursor_example; // String | 

try {
    final response = api.myConnectionsControllerBlocksV1(limit, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->myConnectionsControllerBlocksV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **num**|  | [optional] 
 **cursor** | **String**|  | [optional] 

### Return type

[**ConnectedUserPageDto**](ConnectedUserPageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myConnectionsControllerFriendsV1**
> ConnectedUserPageDto myConnectionsControllerFriendsV1(limit, cursor)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final num limit = 8.14; // num | 
final String cursor = cursor_example; // String | 

try {
    final response = api.myConnectionsControllerFriendsV1(limit, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->myConnectionsControllerFriendsV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **num**|  | [optional] 
 **cursor** | **String**|  | [optional] 

### Return type

[**ConnectedUserPageDto**](ConnectedUserPageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myConnectionsControllerUnblockV1**
> myConnectionsControllerUnblockV1(userId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String userId = userId_example; // String | 

try {
    api.myConnectionsControllerUnblockV1(userId);
} on DioException catch (e) {
    print('Exception when calling SocialApi->myConnectionsControllerUnblockV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **myConnectionsControllerUnfriendV1**
> myConnectionsControllerUnfriendV1(userId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String userId = userId_example; // String | 

try {
    api.myConnectionsControllerUnfriendV1(userId);
} on DioException catch (e) {
    print('Exception when calling SocialApi->myConnectionsControllerUnfriendV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userDirectoryControllerProfileV1**
> UserProfileDto userDirectoryControllerProfileV1(userId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String userId = userId_example; // String | 

try {
    final response = api.userDirectoryControllerProfileV1(userId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->userDirectoryControllerProfileV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **userId** | **String**|  | 

### Return type

[**UserProfileDto**](UserProfileDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userDirectoryControllerSearchV1**
> UserSearchPageDto userDirectoryControllerSearchV1(query, limit, cursor)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getSocialApi();
final String query = query_example; // String | 2 to 50 characters after trimming.
final num limit = 8.14; // num | 
final String cursor = cursor_example; // String | 

try {
    final response = api.userDirectoryControllerSearchV1(query, limit, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling SocialApi->userDirectoryControllerSearchV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **query** | **String**| 2 to 50 characters after trimming. | 
 **limit** | **num**|  | [optional] 
 **cursor** | **String**|  | [optional] 

### Return type

[**UserSearchPageDto**](UserSearchPageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

