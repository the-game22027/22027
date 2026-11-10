import { Module } from '@nestjs/common';
import { MatchScenarios } from './application/match-scenarios';
import { MatchSimulator } from './application/match-simulator';
import { MatchdayRunner } from './application/matchday-runner';
import { FootballIngestionModule } from './football-ingestion.module';
import { MOCK_DAY_COMMANDS } from './presentation/cli/mock-day.commands';
import { MOCK_MATCH_COMMANDS } from './presentation/cli/mock-match.commands';

@Module({
  imports: [FootballIngestionModule],
  providers: [MatchSimulator, MatchdayRunner, MatchScenarios, ...MOCK_MATCH_COMMANDS, ...MOCK_DAY_COMMANDS],
  exports: [MatchSimulator, MatchdayRunner, MatchScenarios],
})
export class FootballSimulatorModule {}
