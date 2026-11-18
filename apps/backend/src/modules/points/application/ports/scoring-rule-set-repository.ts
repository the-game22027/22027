import type { LedgerCategory } from '../../domain/battle-ledger-entries';

export const SCORING_RULE_SET_REPOSITORY = Symbol('SCORING_RULE_SET_REPOSITORY');

export interface ActiveRuleSet {
  id: string;
  game: LedgerCategory;
  version: number;
  name: string;
  /** Validated by the game module that owns the rules (01 §2.9). */
  config: unknown;
}

export interface NewActiveRuleSet {
  id: string;
  game: LedgerCategory;
  version: number;
  name: string;
  config: unknown;
  activatedAt: Date;
  createdBy: string;
}

export interface ScoringRuleSetRepository {
  findActiveRuleSet(game: LedgerCategory): Promise<ActiveRuleSet | null>;
  /** Holds until the transaction ends, so two activations of one game run one after the other. */
  waitForOtherActivations(game: LedgerCategory): Promise<void>;
  findHighestVersion(game: LedgerCategory): Promise<number>;
  retireActiveRuleSet(game: LedgerCategory): Promise<void>;
  insertActiveRuleSet(ruleSet: NewActiveRuleSet): Promise<void>;
}
