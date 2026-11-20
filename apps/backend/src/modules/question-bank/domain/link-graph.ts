import type { EntityKind, LocalizedText } from './question-content';
import type { KnownEntity } from './answer-catalog';

/** Links the pipeline stores between catalog entities (08 §15.4, ADR-0024). */
export const LINK_TYPES = [
  'FACED_IN_FINAL',
  'FACED_IN_KNOCKOUT',
  'SCORED_IN_SAME_MATCH',
  'ASSISTED',
  'SCORED_AGAINST',
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

/** How a receiver must be linked to the ball: a stored link read from one of its ends. */
export const PASS_TYPES = [
  'FACED_IN_FINAL',
  'FACED_IN_KNOCKOUT',
  'SCORED_IN_SAME_MATCH',
  'ASSIST_GIVEN',
  'ASSIST_RECEIVED',
  'SCORED_AGAINST',
  'CONCEDED_TO',
] as const;
export type PassType = (typeof PASS_TYPES)[number];

/** What the ball and the answer of each pass type are. */
export const PASS_TYPE_ENDS: Record<PassType, { ball: EntityKind; answer: EntityKind }> = {
  FACED_IN_FINAL: { ball: 'PLAYER', answer: 'PLAYER' },
  FACED_IN_KNOCKOUT: { ball: 'PLAYER', answer: 'PLAYER' },
  SCORED_IN_SAME_MATCH: { ball: 'PLAYER', answer: 'PLAYER' },
  ASSIST_GIVEN: { ball: 'PLAYER', answer: 'PLAYER' },
  ASSIST_RECEIVED: { ball: 'PLAYER', answer: 'PLAYER' },
  SCORED_AGAINST: { ball: 'PLAYER', answer: 'CLUB' },
  CONCEDED_TO: { ball: 'CLUB', answer: 'PLAYER' },
};

const SYMMETRIC_LINK_TYPES: readonly LinkType[] = ['FACED_IN_FINAL', 'FACED_IN_KNOCKOUT', 'SCORED_IN_SAME_MATCH'];

/** One line of links.jsonl: `ASSISTED` goes from the assist provider to the scorer, `SCORED_AGAINST` from the player to the club. */
export interface BundleLink {
  from: string;
  type: LinkType;
  to: string;
  /** Key of the evidence match in link-matches.jsonl. */
  match: string;
}

/** One line of link-matches.jsonl: the match that makes links true, as text in each language. */
export interface BundleLinkMatch {
  key: string;
  evidence: LocalizedText;
}

/** A link as the app stores it: from the ball's side, under the pass type that finds the other end. */
export interface PassReading {
  fromRef: string;
  passType: PassType;
  toRef: string;
  matchKey: string;
}

/** Both readings of a link, so every lookup can start from the ball (08 §15.8). */
export function readLinkFromBothEnds(link: BundleLink): [PassReading, PassReading] {
  const reading = (fromRef: string, passType: PassType, toRef: string): PassReading => ({
    fromRef,
    passType,
    toRef,
    matchKey: link.match,
  });
  switch (link.type) {
    case 'ASSISTED':
      return [reading(link.from, 'ASSIST_GIVEN', link.to), reading(link.to, 'ASSIST_RECEIVED', link.from)];
    case 'SCORED_AGAINST':
      return [reading(link.from, 'SCORED_AGAINST', link.to), reading(link.to, 'CONCEDED_TO', link.from)];
    case 'FACED_IN_FINAL':
    case 'FACED_IN_KNOCKOUT':
    case 'SCORED_IN_SAME_MATCH':
      return [reading(link.from, link.type, link.to), reading(link.to, link.type, link.from)];
  }
}

// A broken graph can have thousands of problems; the first ones are enough to fix the pipeline.
const MAX_REPORTED_LINK_PROBLEMS = 50;

/** Problems of a graph against itself and the catalog: unknown matches, wrong kinds, self links, repeated links. */
export function findLinkGraphProblems(
  links: readonly BundleLink[],
  matches: readonly BundleLinkMatch[],
  findEntity: (externalRef: string) => KnownEntity | undefined,
): string[] {
  const problems: string[] = [];
  const matchKeys = new Set(matches.map((match) => match.key));
  const seen = new Set<string>();
  links.forEach((link, index) => {
    const where = `links.jsonl line ${index + 1}`;
    if (!matchKeys.has(link.match)) problems.push(`${where}: match ${link.match} is not in link-matches.jsonl`);
    if (link.from === link.to) problems.push(`${where}: a link joins two different entities`);
    const [forward, backward] = readLinkFromBothEnds(link);
    for (const [end, ref, kind] of [
      ['from', link.from, PASS_TYPE_ENDS[forward.passType].ball],
      ['to', link.to, PASS_TYPE_ENDS[backward.passType].ball],
    ] as const) {
      const entity = findEntity(ref);
      if (!entity) problems.push(`${where}: ${end} ${ref} is not in the answer catalog`);
      else if (entity.kind !== kind) problems.push(`${where}: ${end} ${ref} is a ${entity.kind}, expected ${kind}`);
    }
    const [first, second] =
      SYMMETRIC_LINK_TYPES.includes(link.type) && link.to < link.from ? [link.to, link.from] : [link.from, link.to];
    const key = `${link.type}|${first}|${second}`;
    if (seen.has(key)) problems.push(`${where}: the same ${link.type} link appears twice`);
    seen.add(key);
  });
  if (problems.length <= MAX_REPORTED_LINK_PROBLEMS) return problems;
  return [
    ...problems.slice(0, MAX_REPORTED_LINK_PROBLEMS),
    `… and ${problems.length - MAX_REPORTED_LINK_PROBLEMS} more link problems`,
  ];
}
