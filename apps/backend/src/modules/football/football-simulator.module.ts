import { Module } from '@nestjs/common';
import { MatchScenarios } from './application/match-scenarios';
import { MatchSimulator } from './application/match-simulator';
import { MatchdayRunner } from './application/matchday-runner';
import { FootballIngestionModule } from './football-ingestion.module';

@Module({
  imports: [FootballIngestionModule],
  providers: [MatchSimulator, MatchdayRunner, MatchScenarios],
  exports: [MatchSimulator, MatchdayRunner, MatchScenarios],
})
export class FootballSimulatorModule {}
