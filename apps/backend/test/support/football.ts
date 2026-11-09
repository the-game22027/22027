import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/shared/infrastructure/persistence';

const team = (prisma: PrismaService, en: string, ar?: string) =>
  prisma.team.create({ data: { id: randomUUID(), names: { en, ...(ar ? { ar } : {}) }, type: 'CLUB' } });

export async function createFixtureWorld(prisma: PrismaService) {
  const code = `T-${randomUUID()}`;
  const competition = await prisma.competition.create({
    data: {
      id: randomUUID(),
      code,
      names: { en: 'Test League', ar: 'دوري الاختبار' },
      type: 'LEAGUE',
      isNationalTeams: false,
    },
  });
  const season = await prisma.season.create({
    data: {
      id: randomUUID(),
      competitionId: competition.id,
      label: '2026-27',
      startsOn: new Date('2026-08-01'),
      endsOn: new Date('2027-05-31'),
    },
  });
  const home = await team(prisma, 'Liverpool', 'ليفربول');
  const away = await team(prisma, 'Everton');

  const createMatch = (kickoffAt: string, status: 'SCHEDULED' | 'FINISHED' | 'POSTPONED' = 'SCHEDULED') =>
    prisma.match.create({
      data: {
        id: randomUUID(),
        competitionId: competition.id,
        seasonId: season.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        kickoffAt: new Date(kickoffAt),
        status,
        provider: 'test',
        providerMatchId: randomUUID(),
      },
    });

  return { competition, season, home, away, createMatch };
}
