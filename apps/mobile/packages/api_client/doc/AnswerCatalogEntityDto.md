# api_client.model.AnswerCatalogEntityDto

## Load the model package
```dart
import 'package:api_client/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**kind** | **String** | One of ENTITY_KINDS; clients must tolerate unknown values. | 
**names** | [**LocalizedEntityNamesDto**](LocalizedEntityNamesDto.md) |  | 
**popularity** | **num** |  | 
**search** | **List&lt;String&gt;** | Normalized names and aliases (07 §5.7): what the app searches while the player types. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


