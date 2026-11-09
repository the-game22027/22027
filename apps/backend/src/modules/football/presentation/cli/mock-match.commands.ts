import { Command, CommandRunner } from 'nest-commander';
import type { ApplyOutcome } from '../../application/apply-provider-match-update';
import { MatchSimulator } from '../../application/match-simulator';
import { parseInstant, parseMatchId, parseScore } from './mock-args';

const report = (matchId: string, outcome: ApplyOutcome): void => {
  process.stdout.write(`${matchId}: ${outcome}\n`);
};

@Command({ name: 'mock:kickoff', arguments: '<matchId>', description: 'Start a match' })
export class MockKickoffCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.kickoff(matchId));
  }
}

@Command({ name: 'mock:score', arguments: '<matchId> <score>', description: 'Set the score of a live match (2-1)' })
export class MockScoreCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id, score]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.score(matchId, parseScore(score)));
  }
}

@Command({ name: 'mock:finish', arguments: '<matchId> [score]', description: 'Blow the final whistle' })
export class MockFinishCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id, score]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.finish(matchId, score ? parseScore(score) : undefined));
  }
}

@Command({ name: 'mock:postpone', arguments: '<matchId>', description: 'Postpone a match' })
export class MockPostponeCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.postpone(matchId));
  }
}

@Command({ name: 'mock:reschedule', arguments: '<matchId> <iso>', description: 'Set a new kickoff time (UTC)' })
export class MockRescheduleCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id, iso]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.reschedule(matchId, parseInstant(iso)));
  }
}

@Command({ name: 'mock:cancel', arguments: '<matchId>', description: 'Cancel a match' })
export class MockCancelCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.cancel(matchId));
  }
}

@Command({ name: 'mock:abandon', arguments: '<matchId>', description: 'Abandon a live match' })
export class MockAbandonCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.abandon(matchId));
  }
}

@Command({ name: 'mock:correct-result', arguments: '<matchId> <score>', description: 'Correct a finished result' })
export class MockCorrectResultCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id, score]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.correctResult(matchId, parseScore(score)));
  }
}

@Command({ name: 'mock:correct-end-time', arguments: '<matchId> <iso>', description: 'Correct the end time (UTC)' })
export class MockCorrectEndTimeCommand extends CommandRunner {
  constructor(private readonly simulator: MatchSimulator) {
    super();
  }

  async run([id, iso]: string[]): Promise<void> {
    const matchId = parseMatchId(id);
    report(matchId, await this.simulator.correctEndTime(matchId, parseInstant(iso)));
  }
}

export const MOCK_MATCH_COMMANDS = [
  MockKickoffCommand,
  MockScoreCommand,
  MockFinishCommand,
  MockPostponeCommand,
  MockRescheduleCommand,
  MockCancelCommand,
  MockAbandonCommand,
  MockCorrectResultCommand,
  MockCorrectEndTimeCommand,
];
