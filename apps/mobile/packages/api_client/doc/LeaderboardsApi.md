# api_client.api.LeaderboardsApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**leaderboardsControllerMyRankV1**](LeaderboardsApi.md#leaderboardscontrollermyrankv1) | **GET** /v1/leaderboards/{kind}/{periodKey}/me | 
[**leaderboardsControllerPageV1**](LeaderboardsApi.md#leaderboardscontrollerpagev1) | **GET** /v1/leaderboards/{kind}/{periodKey} | 
[**leaderboardsControllerPeriodsV1**](LeaderboardsApi.md#leaderboardscontrollerperiodsv1) | **GET** /v1/leaderboards/periods | 


# **leaderboardsControllerMyRankV1**
> MyRankDto leaderboardsControllerMyRankV1(kind, periodKey, category)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getLeaderboardsApi();
final String kind = kind_example; // String | 
final String periodKey = periodKey_example; // String | `current`, or a key such as 2026-W46, 2026-11, 2026-27, all.
final String category = category_example; // String | 

try {
    final response = api.leaderboardsControllerMyRankV1(kind, periodKey, category);
    print(response);
} on DioException catch (e) {
    print('Exception when calling LeaderboardsApi->leaderboardsControllerMyRankV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **kind** | **String**|  | 
 **periodKey** | **String**| `current`, or a key such as 2026-W46, 2026-11, 2026-27, all. | 
 **category** | **String**|  | 

### Return type

[**MyRankDto**](MyRankDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **leaderboardsControllerPageV1**
> LeaderboardPageDto leaderboardsControllerPageV1(kind, periodKey, category, limit, cursor)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getLeaderboardsApi();
final String kind = kind_example; // String | 
final String periodKey = periodKey_example; // String | `current`, or a key such as 2026-W46, 2026-11, 2026-27, all.
final String category = category_example; // String | 
final num limit = 8.14; // num | 
final String cursor = cursor_example; // String | 

try {
    final response = api.leaderboardsControllerPageV1(kind, periodKey, category, limit, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling LeaderboardsApi->leaderboardsControllerPageV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **kind** | **String**|  | 
 **periodKey** | **String**| `current`, or a key such as 2026-W46, 2026-11, 2026-27, all. | 
 **category** | **String**|  | 
 **limit** | **num**|  | [optional] 
 **cursor** | **String**|  | [optional] 

### Return type

[**LeaderboardPageDto**](LeaderboardPageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **leaderboardsControllerPeriodsV1**
> LeaderboardPeriodListDto leaderboardsControllerPeriodsV1(kind)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getLeaderboardsApi();
final String kind = kind_example; // String | 

try {
    final response = api.leaderboardsControllerPeriodsV1(kind);
    print(response);
} on DioException catch (e) {
    print('Exception when calling LeaderboardsApi->leaderboardsControllerPeriodsV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **kind** | **String**|  | 

### Return type

[**LeaderboardPeriodListDto**](LeaderboardPeriodListDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

