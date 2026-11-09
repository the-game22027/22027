import { Injectable } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { type MatchdayStep, planMatchday } from '../domain/matchday-timeline';
import { MatchSimulator } from './match-simulator';

export interface MatchdayResult {
  readonly matches: number;
  readonly steps: number;
}

@Injectable()
export class MatchdayRunner {
  constructor(private readonly simulator: MatchSimulator) {}

  /** `speed` compresses the day: at 60, one simulated minute takes one real second. */
  async run(speed: number, onStep: (step: MatchdayStep) => void = () => undefined): Promise<MatchdayResult> {
    const fixtures = await this.simulator.nextMatchday();
    const steps = planMatchday(fixtures);
    let simulatedMs = 0;
    for (const step of steps) {
      await sleep((step.atMs - simulatedMs) / speed);
      simulatedMs = step.atMs;
      await this.play(step);
      onStep(step);
    }
    return { matches: fixtures.length, steps: steps.length };
  }

  private async play(step: MatchdayStep): Promise<void> {
    if (step.kind === 'KICKOFF') await this.simulator.kickoff(step.matchId);
    if (step.kind === 'SCORE') await this.simulator.score(step.matchId, step.score);
    if (step.kind === 'FINISH') await this.simulator.finish(step.matchId, step.score);
  }
}
