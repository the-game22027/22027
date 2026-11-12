# `.g.dart` files: code written by `build_runner`
> A `.g.dart` file is a `part` of a model file. `build_runner` writes it from annotations, so the model gets `fromJson`, `toJson` and `copyWith` without hand-written boilerplate.

**Problem:** every DTO needs field-by-field JSON parsing (casts, required keys, enum strings). Written by hand for 30 models, it is long, and one typo in a key fails only at runtime.

**How:**
- The model has an annotation (`@JsonSerializable`) and the line `part 'x_dto.g.dart';`. The `.g.dart` starts with `part of 'x_dto.dart';`: the two files are one library, so generated functions can be private (`_$XDtoFromJson`).
- `fromJson` only forwards: `factory XDto.fromJson(Map<String, dynamic> json) => _$XDtoFromJson(json);`. The generated function checks required keys, casts each field and decodes enums (unknown values become `unknownDefaultOpenApi`).
- `deserialize.dart` picks the right `fromJson` by type name when Dio gets a response.
- `copy_with_extension` adds `copyWith` to the same `.g.dart`.

**In our code:** [matchmaking_ticket_dto.dart](../../apps/mobile/packages/api_client/lib/src/model/matchmaking_ticket_dto.dart) and its [.g.dart](../../apps/mobile/packages/api_client/lib/src/model/matchmaking_ticket_dto.g.dart), [deserialize.dart](../../apps/mobile/packages/api_client/lib/src/deserialize.dart). `tool/generate_api_client.sh` runs `build_runner` after `openapi-generator`.

**Watch out:**
- Never edit a `.g.dart`: the next generation overwrites it. Change the source (here: the backend contract) and regenerate.
- A model and its `.g.dart` live and die together: deleting `answer_catalog_dto.dart` (P6.6) deleted its `.g.dart` too.
- A missing or stale `.g.dart` shows up as "undefined `_$XDtoFromJson`": run the generator, do not write the function.

**Check yourself:** why can the generated function be private (`_$…`) when it lives in another file?
<details><summary>Answer</summary>`part` / `part of` make both files one library, and Dart privacy is per library, not per file.</details>
