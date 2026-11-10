# api_client.api.FootballApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**footballControllerCompetitionsV1**](FootballApi.md#footballcontrollercompetitionsv1) | **GET** /v1/competitions | 
[**footballControllerMatchV1**](FootballApi.md#footballcontrollermatchv1) | **GET** /v1/matches/{matchId} | 
[**footballControllerMatchesV1**](FootballApi.md#footballcontrollermatchesv1) | **GET** /v1/matches | 
[**footballControllerSquadsV1**](FootballApi.md#footballcontrollersquadsv1) | **GET** /v1/matches/{matchId}/squads | 


# **footballControllerCompetitionsV1**
> CompetitionListDto footballControllerCompetitionsV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getFootballApi();

try {
    final response = api.footballControllerCompetitionsV1();
    print(response);
} on DioException catch (e) {
    print('Exception when calling FootballApi->footballControllerCompetitionsV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**CompetitionListDto**](CompetitionListDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **footballControllerMatchV1**
> MatchDetailDto footballControllerMatchV1(matchId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getFootballApi();
final String matchId = matchId_example; // String | 

try {
    final response = api.footballControllerMatchV1(matchId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling FootballApi->footballControllerMatchV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **matchId** | **String**|  | 

### Return type

[**MatchDetailDto**](MatchDetailDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **footballControllerMatchesV1**
> MatchPageDto footballControllerMatchesV1(from, to, competitionId, status, limit, cursor)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getFootballApi();
final String from = from_example; // String | 
final String to = to_example; // String | 
final String competitionId = 38400000-8cf0-11bd-b23e-10b96e4ef00d; // String | 
final String status = status_example; // String | 
final num limit = 8.14; // num | 
final String cursor = cursor_example; // String | 

try {
    final response = api.footballControllerMatchesV1(from, to, competitionId, status, limit, cursor);
    print(response);
} on DioException catch (e) {
    print('Exception when calling FootballApi->footballControllerMatchesV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **from** | **String**|  | [optional] 
 **to** | **String**|  | [optional] 
 **competitionId** | **String**|  | [optional] 
 **status** | **String**|  | [optional] 
 **limit** | **num**|  | [optional] 
 **cursor** | **String**|  | [optional] 

### Return type

[**MatchPageDto**](MatchPageDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **footballControllerSquadsV1**
> SquadListDto footballControllerSquadsV1(matchId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getFootballApi();
final String matchId = matchId_example; // String | 

try {
    final response = api.footballControllerSquadsV1(matchId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling FootballApi->footballControllerSquadsV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **matchId** | **String**|  | 

### Return type

[**SquadListDto**](SquadListDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

