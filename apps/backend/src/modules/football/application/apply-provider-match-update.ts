import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriter } from '@shared/infrastructure/outbox';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import {
  type CurrentMatch,
  type IncomingMatch,
  type MatchEvent,
  type MatchResult,
  planMatchUpdate,
} from '../domain/match-lifecycle';
import {
  MATCH_WRITE_REPOSITORY,
  type MatchRefs,
  type MatchWriteRepository,
  type StoredMatch,
} from './ports/match-write-repository';

export interface ProviderMatchUpdate extends IncomingMatch {
  readonly provider: string;
  readonly providerMatchId: string;
  readonly refs: MatchRefs;
}

export type ApplyOutcome = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'STALE' | 'REJECTED';

const blankMatch = (kickoffAt: Date): CurrentMatch => ({
  status: 'SCHEDULED',
  kickoffAt,
  startedAt: null,
  endedAt: null,
  homeScore: null,
  awayScore: null,
  decidedBy: null,
  homePenalties: null,
  awayPenalties: null,
  resultVersion: 0,
  providerUpdatedAt: null,
});

@Injectable()
export class ApplyProviderMatchUpdate {
  private readonly logger = new Logger(ApplyProviderMatchUpdate.name);

  constructor(
    @Inject(MATCH_WRITE_REPOSITORY) private readonly matches: MatchWriteRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly outbox: OutboxWriter,
  ) {}

  @Transactional()
  async apply(update: ProviderMatchUpdate): Promise<ApplyOutcome> {
    const existing =
      (await this.matches.findForUpdate(update.provider, update.providerMatchId)) ??
      (await this.createOrFindWinner(update));
    return existing === 'CREATED' || existing === 'REJECTED' ? existing : this.applyTo(existing, update);
  }

  private async createOrFindWinner(update: ProviderMatchUpdate): Promise<StoredMatch | 'CREATED' | 'REJECTED'> {
    const plan = planMatchUpdate(blankMatch(update.kickoffAt), update);
    if (plan.kind !== 'APPLY') return this.reject(update, plan.kind === 'REJECTED' ? plan.reason : 'stale');

    const id = this.ids.next();
    const inserted = await this.matches.insertIfAbsent({
      ...update.refs,
      id,
      provider: update.provider,
      providerMatchId: update.providerMatchId,
      providerUpdatedAt: update.updatedAt,
      state: plan.next,
    });
    if (inserted) {
      // Only this event: a match first seen as finished was never open, so nothing should react to its result.
      await this.publish(id, 'MatchScheduled', { kickoffAt: update.kickoffAt.toISOString() });
      return 'CREATED';
    }
    const winner = await this.matches.findForUpdate(update.provider, update.providerMatchId);
    if (!winner) throw new Error(`Match ${update.providerMatchId} conflicted on insert but cannot be found`);
    return winner;
  }

  private async applyTo(match: StoredMatch, update: ProviderMatchUpdate): Promise<ApplyOutcome> {
    const plan = planMatchUpdate(match, update);
    if (plan.kind === 'STALE') return 'STALE';
    if (plan.kind === 'REJECTED') return this.reject(update, plan.reason);

    await this.matches.update(match.id, plan.next, update.updatedAt, plan.changed);
    for (const event of plan.events) {
      await this.publish(match.id, event.type, payloadOf(event));
    }
    return plan.changed ? 'UPDATED' : 'UNCHANGED';
  }

  private reject(update: ProviderMatchUpdate, reason: string): 'REJECTED' {
    this.logger.warn(`Rejected update for ${update.provider}/${update.providerMatchId}: ${reason}`);
    return 'REJECTED';
  }

  private async publish(matchId: string, type: string, data: Readonly<Record<string, unknown>>): Promise<void> {
    await this.outbox.write({
      type,
      version: 1,
      aggregateType: 'match',
      aggregateId: matchId,
      payload: { matchId, ...data },
    });
  }
}

function scoreOf(result: MatchResult): Record<string, unknown> {
  return {
    home: result.homeScore,
    away: result.awayScore,
    decidedBy: result.decidedBy,
    ...(result.homePenalties !== null && result.awayPenalties !== null
      ? { penalties: { home: result.homePenalties, away: result.awayPenalties } }
      : {}),
  };
}

function payloadOf(event: MatchEvent): Record<string, unknown> {
  const fields = Object.entries(event).filter(([key]) => key !== 'type') as [string, unknown][];
  return Object.fromEntries(
    fields.map(([key, value]) => {
      if (key === 'result') return ['score', scoreOf(value as MatchResult)];
      return [key, value instanceof Date ? value.toISOString() : value];
    }),
  );
}
