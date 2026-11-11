# api_client.api.PredictionsApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**predictionsControllerGetOwnV1**](PredictionsApi.md#predictionscontrollergetownv1) | **GET** /v1/matches/{matchId}/prediction | 
[**predictionsControllerSubmitV1**](PredictionsApi.md#predictionscontrollersubmitv1) | **PUT** /v1/matches/{matchId}/prediction | 


# **predictionsControllerGetOwnV1**
> PredictionDto predictionsControllerGetOwnV1(matchId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getPredictionsApi();
final String matchId = matchId_example; // String | 

try {
    final response = api.predictionsControllerGetOwnV1(matchId);
    print(response);
} on DioException catch (e) {
    print('Exception when calling PredictionsApi->predictionsControllerGetOwnV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **matchId** | **String**|  | 

### Return type

[**PredictionDto**](PredictionDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **predictionsControllerSubmitV1**
> PredictionDto predictionsControllerSubmitV1(matchId, submitPredictionDto)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getPredictionsApi();
final String matchId = matchId_example; // String | 
final SubmitPredictionDto submitPredictionDto = ; // SubmitPredictionDto | 

try {
    final response = api.predictionsControllerSubmitV1(matchId, submitPredictionDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling PredictionsApi->predictionsControllerSubmitV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **matchId** | **String**|  | 
 **submitPredictionDto** | [**SubmitPredictionDto**](SubmitPredictionDto.md)|  | 

### Return type

[**PredictionDto**](PredictionDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

