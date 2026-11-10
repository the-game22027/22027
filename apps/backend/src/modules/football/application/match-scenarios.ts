import { Injectable } from '@nestjs/common';
import { SimulationRejectedError } from '../domain/football-errors';
import type { ScheduledFixture } from './ports/match-write-repository';
import { MatchSimulator } from './match-simulator';

const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;

export const SCENARIO_NAMES = ['kickoff-change', 'postponed', 'result-corrected', 'abandoned'] as const;
export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export const isScenarioName = (name: string): name is ScenarioName =>
  (SCENARIO_NAMES as readonly string[]).includes(name);

@Injectable()
export class MatchScenarios {
  constructor(private readonly simulator: MatchSimulator) {}

  /** Plays the scenario on the next scheduled match and returns that match's id. */
  async play(name: ScenarioName): Promise<string> {
    const fixtures = await this.simulator.nextMatchday();
    if (fixtures.length === 0) throw new SimulationRejectedError('No scheduled match to use.');
    await this.steps(name, fixtures[0]);
    return fixtures[0].matchId;
  }

  private async steps(name: ScenarioName, { matchId, kickoffAt }: ScheduledFixture): Promise<void> {
    const sim = this.simulator;
    switch (name) {
      case 'kickoff-change':
        await sim.reschedule(matchId, new Date(kickoffAt.getTime() + 2 * HOUR));
        return;
      case 'postponed':
        await sim.postpone(matchId);
        await sim.reschedule(matchId, new Date(kickoffAt.getTime() + WEEK));
        return;
      case 'result-corrected':
        await sim.kickoff(matchId);
        await sim.finish(matchId, { home: 1, away: 0 });
        await sim.correctResult(matchId, { home: 2, away: 0 });
        return;
      case 'abandoned':
        await sim.kickoff(matchId);
        await sim.score(matchId, { home: 1, away: 0 });
        await sim.abandon(matchId);
    }
  }
}
