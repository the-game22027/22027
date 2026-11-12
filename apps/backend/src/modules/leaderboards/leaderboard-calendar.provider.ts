import type { Provider } from '@nestjs/common';
import { AppConfig } from '@shared/infrastructure/config';
import { LEADERBOARD_CALENDAR } from './application/ports/leaderboard-repository';
import { loadLeaderboardCalendarFile } from './infrastructure/leaderboard-calendar-file';

/** Both processes read the same calendar: the API to name periods, the worker to fill them. */
export const leaderboardCalendarProvider: Provider = {
  provide: LEADERBOARD_CALENDAR,
  inject: [AppConfig],
  useFactory: (config: AppConfig) => loadLeaderboardCalendarFile(config.leaderboardConfigPath, config.isProduction),
};
