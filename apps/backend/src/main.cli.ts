import 'reflect-metadata';
import { CommandFactory } from 'nest-commander';
import { loadConfigOrExit } from './bootstrap/load-config';
import { CliModule } from './cli.module';

async function bootstrap(): Promise<void> {
  await CommandFactory.run(CliModule.register(loadConfigOrExit()), {
    logger: ['warn', 'error'],
    cliName: 'the-game',
    serviceErrorHandler: (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  });
}

void bootstrap();
