# api_client.api.BattlesApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**battlesControllerJoinV1**](BattlesApi.md#battlescontrollerjoinv1) | **POST** /v1/battles/matchmaking | Same as WS &#x60;matchmaking:join&#x60;; the match itself still arrives on the socket as &#x60;battle:found&#x60;.
[**battlesControllerLeaveV1**](BattlesApi.md#battlescontrollerleavev1) | **DELETE** /v1/battles/matchmaking | 
[**battlesControllerPlayStateV1**](BattlesApi.md#battlescontrollerplaystatev1) | **GET** /v1/me/play-state | 


# **battlesControllerJoinV1**
> MatchmakingTicketDto battlesControllerJoinV1(joinMatchmakingDto)

Same as WS `matchmaking:join`; the match itself still arrives on the socket as `battle:found`.

### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getBattlesApi();
final JoinMatchmakingDto joinMatchmakingDto = ; // JoinMatchmakingDto | 

try {
    final response = api.battlesControllerJoinV1(joinMatchmakingDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling BattlesApi->battlesControllerJoinV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **joinMatchmakingDto** | [**JoinMatchmakingDto**](JoinMatchmakingDto.md)|  | 

### Return type

[**MatchmakingTicketDto**](MatchmakingTicketDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **battlesControllerLeaveV1**
> battlesControllerLeaveV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getBattlesApi();

try {
    api.battlesControllerLeaveV1();
} on DioException catch (e) {
    print('Exception when calling BattlesApi->battlesControllerLeaveV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **battlesControllerPlayStateV1**
> PlayStateDto battlesControllerPlayStateV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getBattlesApi();

try {
    final response = api.battlesControllerPlayStateV1();
    print(response);
} on DioException catch (e) {
    print('Exception when calling BattlesApi->battlesControllerPlayStateV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**PlayStateDto**](PlayStateDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

