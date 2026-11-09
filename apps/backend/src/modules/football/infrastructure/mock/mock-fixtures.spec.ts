import type { ProviderTeam } from '../../application/ports/football-data-provider';
import { generateFixtures, generateSquad, roundRobin } from './mock-fixtures';

const refs = ['a', 'b', 'c', 'd', 'e', 'f'];
const team = (ref: string): ProviderTeam => ({
  ref,
  names: { en: ref },
  shortName: null,
  type: 'CLUB',
  countryCode: null,
});
const teams = new Map(refs.map((ref) => [ref, team(ref)]));
const anchor = new Date('2026-11-09T12:30:00Z');
const names = { first: [{ en: 'Omar', ar: 'عمر' }], last: [{ en: 'Rossi', ar: 'روسي' }] };

describe('roundRobin', () => {
  const rounds = roundRobin(refs);

  it('plays each pair home and away, once each', () => {
    const fixtures = rounds.flat().map(([home, away]) => `${home}-${away}`);
    expect(fixtures).toHaveLength(30);
    expect(new Set(fixtures).size).toBe(30);
  });

  it('never gives a team two matches in a round', () => {
    for (const round of rounds) expect(new Set(round.flat()).size).toBe(refs.length);
  });
});

describe('generateFixtures', () => {
  const fixtures = generateFixtures([{ code: 'L', teams: refs }], teams, anchor);

  it('gives the same schedule for the same anchor', () => {
    expect(generateFixtures([{ code: 'L', teams: refs }], teams, anchor)).toEqual(fixtures);
  });

  it('covers finished, live and upcoming matches', () => {
    expect(new Set(fixtures.map((fixture) => fixture.status))).toEqual(new Set(['FINISHED', 'LIVE', 'SCHEDULED']));
  });

  it('makes finished matches complete and upcoming matches empty', () => {
    for (const fixture of fixtures) {
      if (fixture.status === 'FINISHED') {
        expect(fixture.endedAt).not.toBeNull();
        expect(fixture.homeScore).not.toBeNull();
      }
      if (fixture.status === 'SCHEDULED') expect(fixture.homeScore).toBeNull();
    }
  });
});

describe('generateSquad', () => {
  const squad = generateSquad(team('a'), names);

  it('has 11 starters and 7 substitutes with unique shirts', () => {
    expect(squad.filter((entry) => entry.role === 'STARTER')).toHaveLength(11);
    expect(squad.filter((entry) => entry.role === 'SUBSTITUTE')).toHaveLength(7);
    expect(new Set(squad.map((entry) => entry.shirtNumber)).size).toBe(18);
  });

  it('starts one goalkeeper', () => {
    expect(squad.filter((entry) => entry.role === 'STARTER' && entry.player.position === 'GK')).toHaveLength(1);
  });
});
