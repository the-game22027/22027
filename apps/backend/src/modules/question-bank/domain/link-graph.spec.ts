import type { KnownEntity } from './answer-catalog';
import { type BundleLink, findLinkGraphProblems, readLinkFromBothEnds } from './link-graph';

const names = { en: 'x', ar: 'س' };
const catalog: Record<string, KnownEntity> = {
  'wd:ramos': { kind: 'PLAYER', names },
  'wd:modric': { kind: 'PLAYER', names },
  'wd:atletico': { kind: 'CLUB', names },
};
const link = (change: Partial<BundleLink> = {}): BundleLink => ({
  from: 'wd:modric',
  type: 'ASSISTED',
  to: 'wd:ramos',
  match: 'ucl:2014',
  ...change,
});
const problemsOf = (links: BundleLink[], matchKeys = ['ucl:2014']) =>
  findLinkGraphProblems(
    links,
    matchKeys.map((key) => ({ key, evidence: { en: key, ar: key } })),
    (ref) => catalog[ref],
  ).join('\n');

describe('the ONE_TWO link graph', () => {
  it('reads every link from both ends under the pass type that finds the other end', () => {
    expect(readLinkFromBothEnds(link())).toEqual([
      { fromRef: 'wd:modric', passType: 'ASSIST_GIVEN', toRef: 'wd:ramos', matchKey: 'ucl:2014' },
      { fromRef: 'wd:ramos', passType: 'ASSIST_RECEIVED', toRef: 'wd:modric', matchKey: 'ucl:2014' },
    ]);
    const against = readLinkFromBothEnds(link({ from: 'wd:ramos', type: 'SCORED_AGAINST', to: 'wd:atletico' }));
    expect(against.map((reading) => reading.passType)).toEqual(['SCORED_AGAINST', 'CONCEDED_TO']);
    const faced = readLinkFromBothEnds(link({ type: 'FACED_IN_FINAL' }));
    expect(faced.map((reading) => [reading.fromRef, reading.passType])).toEqual([
      ['wd:modric', 'FACED_IN_FINAL'],
      ['wd:ramos', 'FACED_IN_FINAL'],
    ]);
  });

  it('accepts a graph whose ends are catalog entities of the right kinds', () => {
    expect(problemsOf([link(), link({ from: 'wd:ramos', type: 'SCORED_AGAINST', to: 'wd:atletico' })])).toBe('');
  });

  it('reports unknown matches, unknown or wrong-kind ends, self links and repeated links', () => {
    expect(problemsOf([link({ match: 'ucl:1999' })])).toContain('match ucl:1999 is not in link-matches.jsonl');
    expect(problemsOf([link({ to: 'wd:nobody' })])).toContain('to wd:nobody is not in the answer catalog');
    expect(problemsOf([link({ to: 'wd:atletico' })])).toContain('to wd:atletico is a CLUB, expected PLAYER');
    expect(problemsOf([link({ to: 'wd:modric' })])).toContain('a link joins two different entities');
    const faced = link({ type: 'SCORED_IN_SAME_MATCH' });
    expect(problemsOf([faced, { ...faced, from: faced.to, to: faced.from }])).toContain(
      'the same SCORED_IN_SAME_MATCH link appears twice',
    );
  });

  it('lists at most 50 problems and says how many more there are', () => {
    const broken = Array.from({ length: 60 }, (_, index) => link({ to: `wd:nobody${index}` }));
    const problems = problemsOf(broken).split('\n');
    expect(problems).toHaveLength(51);
    expect(problems[50]).toBe('… and 10 more link problems');
  });
});
