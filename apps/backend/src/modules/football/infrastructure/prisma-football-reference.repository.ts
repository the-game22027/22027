import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import { ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { Prisma } from '@generated/prisma/client';
import type { ProviderCompetition, ProviderPlayer, ProviderTeam } from '../application/ports/football-data-provider';
import type {
  CompetitionKeys,
  FootballReferenceRepository,
  MissingSquad,
  SquadEntry,
} from '../application/ports/football-reference-repository';

const uniqueByRef = <T extends { ref: string }>(items: readonly T[]): T[] => [
  ...new Map(items.map((item) => [item.ref, item])).values(),
];

const SELECT_REFS = { id: true, externalRefs: true } as const;

const namesJson = (names: object): Prisma.InputJsonObject => names;

@Injectable()
export class PrismaFootballReferenceRepository implements FootballReferenceRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async upsertCompetition(competition: ProviderCompetition): Promise<CompetitionKeys> {
    const fields = {
      names: namesJson(competition.names),
      type: competition.type,
      countryCode: competition.countryCode,
      isNationalTeams: competition.isNationalTeams,
    };
    const { id: competitionId } = await this.txHost.tx.competition.upsert({
      where: { code: competition.code },
      create: { id: this.ids.next(), code: competition.code, ...fields },
      update: fields,
      select: { id: true },
    });
    const { label, startsOn, endsOn } = competition.season;
    const { id: seasonId } = await this.txHost.tx.season.upsert({
      where: { competitionId_label: { competitionId, label } },
      create: { id: this.ids.next(), competitionId, label, startsOn, endsOn, isCurrent: true },
      update: { startsOn, endsOn, isCurrent: true },
      select: { id: true },
    });
    return { competitionId, seasonId };
  }

  async ensureTeams(provider: string, teams: readonly ProviderTeam[]): Promise<ReadonlyMap<string, string>> {
    const known = await this.knownRefs(provider, (where) =>
      this.txHost.tx.team.findMany({ where, select: SELECT_REFS }),
    );
    const missing = uniqueByRef(teams).filter((team) => !known.has(team.ref));
    await this.txHost.tx.team.createMany({
      data: missing.map((team) => {
        const id = this.ids.next();
        known.set(team.ref, id);
        return {
          id,
          names: namesJson(team.names),
          shortName: team.shortName,
          type: team.type,
          countryCode: team.countryCode,
          externalRefs: { [provider]: team.ref },
        };
      }),
    });
    return known;
  }

  async ensurePlayers(provider: string, players: readonly ProviderPlayer[]): Promise<ReadonlyMap<string, string>> {
    const known = await this.knownRefs(provider, (where) =>
      this.txHost.tx.player.findMany({ where, select: SELECT_REFS }),
    );
    const missing = uniqueByRef(players).filter((player) => !known.has(player.ref));
    await this.txHost.tx.player.createMany({
      data: missing.map((player) => {
        const id = this.ids.next();
        known.set(player.ref, id);
        return {
          id,
          names: namesJson(player.names),
          position: player.position,
          nationalityCode: player.nationalityCode,
          externalRefs: { [provider]: player.ref },
        };
      }),
    });
    return known;
  }

  async matchesWithoutSquad(provider: string, providerMatchIds: readonly string[]): Promise<MissingSquad[]> {
    const rows = await this.txHost.tx.match.findMany({
      where: { provider, providerMatchId: { in: [...providerMatchIds] }, squad: { none: {} } },
      select: { id: true, providerMatchId: true },
    });
    return rows.map((row) => ({ matchId: row.id, providerMatchId: row.providerMatchId }));
  }

  async addSquad(matchId: string, entries: readonly SquadEntry[]): Promise<void> {
    await this.txHost.tx.matchSquadPlayer.createMany({
      data: entries.map((entry) => ({ matchId, ...entry })),
      skipDuplicates: true,
    });
  }

  async startRun(run: { id: string; provider: string; kind: string; startedAt: Date }): Promise<void> {
    await this.txHost.tx.providerSyncRun.create({ data: { ...run, status: 'RUNNING' } });
  }

  async finishRun(id: string, finishedAt: Date, result: { stats: object } | { error: string }): Promise<void> {
    await this.txHost.tx.providerSyncRun.update({
      where: { id },
      data:
        'stats' in result
          ? { finishedAt, status: 'SUCCEEDED', stats: result.stats }
          : { finishedAt, status: 'FAILED', error: result.error },
    });
  }

  private async knownRefs(
    provider: string,
    find: (where: {
      externalRefs: Prisma.JsonNullableFilter;
    }) => Promise<{ id: string; externalRefs: Prisma.JsonValue }[]>,
  ): Promise<Map<string, string>> {
    const rows = await find({ externalRefs: { path: [provider], not: Prisma.AnyNull } });
    return new Map(rows.map((row) => [(row.externalRefs as Record<string, string>)[provider] ?? '', row.id]));
  }
}
