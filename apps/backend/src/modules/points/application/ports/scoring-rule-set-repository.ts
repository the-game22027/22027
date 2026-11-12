import type { ScoredGame } from '../../domain/battle-ledger-entries';

export const SCORING_RULE_SET_REPOSITORY = Symbol('SCORING_RULE_SET_REPOSITORY');

export interface ActiveRuleSet {
  id: string;
  game: ScoredGame;
  version: number;
  name: string;
  /** Validated by the game module that owns the rules (01 §2.9). */
  config: unknown;
}

export interface NewActiveRuleSet {
  id: string;
  game: ScoredGame;
  version: number;
  name: string;
  config: unknown;
  activatedAt: Date;
  createdBy: string;
}

export interface ScoringRuleSetRepository {
  findActiveRuleSet(game: ScoredGame): Promise<ActiveRuleSet | null>;
  /** Holds until the transaction ends, so two activations of one game run one after the other. */
  waitForOtherActivations(game: ScoredGame): Promise<void>;
  findHighestVersion(game: ScoredGame): Promise<number>;
  retireActiveRuleSet(game: ScoredGame): Promise<void>;
  insertActiveRuleSet(ruleSet: NewActiveRuleSet): Promise<void>;
}
