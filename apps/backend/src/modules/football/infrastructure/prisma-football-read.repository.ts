import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaService, TransactionalAdapterPrisma } from '@shared/infrastructure/persistence';
import type { Prisma } from '@generated/prisma/client';
import type {
  CompetitionRecord,
  MatchFilter,
  MatchPosition,
  MatchRecord,
  SquadPlayerRecord,
} from '../application/football-records';
import type { FootballReadRepository } from '../application/ports/football-read-repository';
import type { LocalizedNames } from '../domain/localized-names';

const MATCH_WITH_RELATIONS = {
  competition: { select: { id: true, code: true, names: true } },
  homeTeam: true,
  awayTeam: true,
} as const;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof MATCH_WITH_RELATIONS }>;

const namesOf = (names: Prisma.JsonValue): LocalizedNames => names as unknown as LocalizedNames;

const teamOf = (team: MatchRow['homeTeam']): MatchRecord['homeTeam'] => ({
  id: team.id,
  names: namesOf(team.names),
  shortName: team.shortName,
  crestUrl: team.crestUrl,
  type: team.type,
});

function matchOf(row: MatchRow): MatchRecord {
  return {
    id: row.id,
    competition: { ...row.competition, names: namesOf(row.competition.names) },
    roundLabel: row.roundLabel,
    homeTeam: teamOf(row.homeTeam),
    awayTeam: teamOf(row.awayTeam),
    kickoffAt: row.kickoffAt,
    status: row.status,
    endedAt: row.endedAt,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    decidedBy: row.decidedBy,
    homePenalties: row.homePenalties,
    awayPenalties: row.awayPenalties,
  };
}

@Injectable()
export class PrismaFootballReadRepository implements FootballReadRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}

  async listActiveCompetitions(): Promise<CompetitionRecord[]> {
    const rows = await this.txHost.tx.competition.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      names: namesOf(row.names),
      type: row.type,
      countryCode: row.countryCode,
      isNationalTeams: row.isNationalTeams,
    }));
  }

  async listMatches(filter: MatchFilter, after: MatchPosition | undefined, take: number): Promise<MatchRecord[]> {
    const rows = await this.txHost.tx.match.findMany({
      where: {
        ...(filter.competitionId ? { competitionId: filter.competitionId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        kickoffAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) },
        ...(after
          ? { OR: [{ kickoffAt: { gt: after.kickoffAt } }, { kickoffAt: after.kickoffAt, id: { gt: after.id } }] }
          : {}),
      },
      orderBy: [{ kickoffAt: 'asc' }, { id: 'asc' }],
      include: MATCH_WITH_RELATIONS,
      take,
    });
    return rows.map(matchOf);
  }

  async findMatch(matchId: string): Promise<MatchRecord | null> {
    const row = await this.txHost.tx.match.findUnique({ where: { id: matchId }, include: MATCH_WITH_RELATIONS });
    return row && matchOf(row);
  }

  async listSquad(matchId: string): Promise<SquadPlayerRecord[]> {
    const rows = await this.txHost.tx.matchSquadPlayer.findMany({
      where: { matchId },
      include: { player: { select: { names: true } } },
      orderBy: [{ teamId: 'asc' }, { role: 'asc' }, { shirtNumber: 'asc' }],
    });
    return rows.map((row) => ({
      playerId: row.playerId,
      names: namesOf(row.player.names),
      teamId: row.teamId,
      role: row.role,
      shirtNumber: row.shirtNumber,
    }));
  }
}
