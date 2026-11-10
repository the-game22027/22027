#!/usr/bin/env bash
# Regenerates packages/api_client from openapi/openapi.json. Never edit the output by hand.
# Needs Docker (the generator is Java, run from its official image) and fvm.
set -euo pipefail
cd "$(dirname "$0")/.."

generator_image="openapitools/openapi-generator-cli:v7.27.0"
output_dir="packages/api_client"

# Start from an empty folder so removed endpoints disappear. Our ignore file is kept.
find "$output_dir" -mindepth 1 -maxdepth 1 ! -name .openapi-generator-ignore -exec rm -rf {} +

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$PWD:/local:z" \
  "$generator_image" generate \
  --input-spec /local/openapi/openapi.json \
  --generator-name dart-dio \
  --output "/local/$output_dir" \
  --template-dir /local/tool/openapi-templates \
  --additional-properties=pubName=api_client,pubDescription="Generated REST client for the-game API",serializationLibrary=json_serializable,enumUnknownDefaultCase=true

# The generator writes models with json_serializable annotations; build_runner writes the *.g.dart code.
(
  cd "$output_dir"
  fvm dart pub get
  fvm dart run build_runner build --delete-conflicting-outputs
  fvm dart format . >/dev/null
)
echo "Regenerated $output_dir from openapi/openapi.json"
