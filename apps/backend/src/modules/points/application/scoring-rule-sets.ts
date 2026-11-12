import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { isDeepStrictEqual } from 'node:util';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import type { ScoredGame } from '../domain/battle-ledger-entries';
import {
  type ActiveRuleSet,
  SCORING_RULE_SET_REPOSITORY,
  type ScoringRuleSetRepository,
} from './ports/scoring-rule-set-repository';

export interface RuleSetActivation {
  ruleSetId: string;
  version: number;
  /** false when the config equals the active one: nothing changed. */
  activated: boolean;
}

/** Versioned scoring configs (01 §2.9). The game module validates a config before it gets here. */
@Injectable()
export class ScoringRuleSets {
  constructor(
    @Inject(SCORING_RULE_SET_REPOSITORY) private readonly ruleSets: ScoringRuleSetRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly outbox: OutboxWriter,
  ) {}

  findActiveRuleSet(game: ScoredGame): Promise<ActiveRuleSet | null> {
    return this.ruleSets.findActiveRuleSet(game);
  }

  /** Stores the config as the next version and retires the active one, in one transaction. */
  @Transactional()
  async activateRuleSet(
    game: ScoredGame,
    name: string,
    config: unknown,
    createdBy: string,
  ): Promise<RuleSetActivation> {
    await this.ruleSets.waitForOtherActivations(game);
    const active = await this.ruleSets.findActiveRuleSet(game);
    if (active && isDeepStrictEqual(active.config, config)) {
      return { ruleSetId: active.id, version: active.version, activated: false };
    }
    const ruleSetId = this.ids.next();
    const version = (await this.ruleSets.findHighestVersion(game)) + 1;
    await this.ruleSets.retireActiveRuleSet(game);
    await this.ruleSets.insertActiveRuleSet({
      id: ruleSetId,
      game,
      version,
      name,
      config,
      activatedAt: this.clock.now(),
      createdBy,
    });
    await this.outbox.write({
      type: 'ScoringRuleSetActivated',
      version: 1,
      aggregateType: 'scoring_rule_set',
      aggregateId: ruleSetId,
      payload: { ruleSetId, game, version },
    });
    return { ruleSetId, version, activated: true };
  }
}
