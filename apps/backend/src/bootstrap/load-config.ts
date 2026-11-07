import { type AppConfig, ConfigValidationError, loadConfig } from '@shared/infrastructure/config';

/**
 * Loads `.env` (if present) and validates the environment before Nest starts. Invalid configuration
 * stops the process with a readable list of problems instead of failing later at first use.
 */
export function loadConfigOrExit(): AppConfig {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file: the environment must provide the variables (CI, containers)
  }
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      process.stderr.write(`${error.message}\nSee apps/backend/.env.example.\n`);
      process.exit(1);
    }
    throw error;
  }
}
