import { resolve } from 'node:path';
import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator.js';
import { SwaggerModule } from '@nestjs/swagger';
import { ReadonlyVisitor } from '@nestjs/swagger/plugin';

const backendRoot = resolve(__dirname, '../..');
const outputDir = resolve(backendRoot, 'src/generated');
const filename = 'swagger-metadata.ts';

/**
 * ts-jest compiles one file at a time, so the Swagger CLI plugin cannot run inside it. This runs the plugin
 * once over the build program (same options as nest-cli.json) and writes what `nest build` would inline.
 */
export function generateSwaggerPluginMetadata(): void {
  new PluginMetadataGenerator().generate({
    visitors: [new ReadonlyVisitor({ classValidatorShim: true, introspectComments: true, pathToSource: outputDir })],
    outputDir,
    filename,
    tsconfigPath: resolve(backendRoot, 'tsconfig.build.json'),
    printDiagnostics: false,
  });
}

/** Must run before the Swagger document is built, so test boots fail on the DTOs that break a real boot. */
export async function loadSwaggerPluginMetadata(): Promise<void> {
  type MetadataFactory = () => Promise<Record<string, unknown>>;
  await SwaggerModule.loadPluginMetadata(async () => {
    // Jest loads the generated file as CommonJS, so its default export arrives wrapped once more.
    const loaded = (await import(resolve(outputDir, filename))) as {
      default: MetadataFactory | { default: MetadataFactory };
    };
    const factory = typeof loaded.default === 'function' ? loaded.default : loaded.default.default;
    return factory();
  });
}
