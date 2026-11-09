import { Command, CommandRunner, Option } from 'nest-commander';
import { isScenarioName, MatchScenarios, SCENARIO_NAMES } from '../../application/match-scenarios';
import { MatchdayRunner } from '../../application/matchday-runner';
import type { MatchdayStep } from '../../domain/matchday-timeline';
import { parseSpeed } from './mock-args';

const describeStep = (step: MatchdayStep): string =>
  step.kind === 'KICKOFF'
    ? `${step.matchId}: KICKOFF`
    : `${step.matchId}: ${step.kind} ${String(step.score.home)}-${String(step.score.away)}`;

@Command({ name: 'mock:run-day', description: 'Play the next matchday in accelerated time' })
export class MockRunDayCommand extends CommandRunner {
  constructor(private readonly runner: MatchdayRunner) {
    super();
  }

  @Option({ flags: '--speed <multiplier>', description: 'How much faster than real time', defaultValue: 60 })
  parseSpeedOption(value: string): number {
    return parseSpeed(value);
  }

  async run(_params: string[], options: { speed: number }): Promise<void> {
    const { matches, steps } = await this.runner.run(options.speed, (step) => {
      process.stdout.write(`${describeStep(step)}\n`);
    });
    process.stdout.write(`Played ${String(matches)} matches in ${String(steps)} steps.\n`);
  }
}

@Command({
  name: 'mock:scenario',
  arguments: '<name>',
  description: `Play an edge case on the next match: ${SCENARIO_NAMES.join(', ')}`,
})
export class MockScenarioCommand extends CommandRunner {
  constructor(private readonly scenarios: MatchScenarios) {
    super();
  }

  async run([name]: string[]): Promise<void> {
    if (!isScenarioName(name)) throw new Error(`Unknown scenario "${name}". Use: ${SCENARIO_NAMES.join(', ')}.`);
    process.stdout.write(`${await this.scenarios.play(name)}: ${name}\n`);
  }
}

export const MOCK_DAY_COMMANDS = [MockRunDayCommand, MockScenarioCommand];
