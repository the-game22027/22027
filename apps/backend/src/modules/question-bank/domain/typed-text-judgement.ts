import type { NameWord } from './answer-catalog';

/** The `answers` section of the battle config (08 §6, ADR-0021). Every value is configuration (DEC-55). */
export interface TypedAnswerRules {
  /** Longer text is refused like blank text. */
  maxLength: number;
  /** Ascending by `fromLetters`: a form with at least that many letters (spaces not counted) allows `edits`. */
  typoTolerance: { fromLetters: number; edits: number }[];
  /** A single word of a name counts alone only when at most this many entities of the same kind have it. */
  singleWordMaxSharedBy: number;
}

/** An accepted answer of a slot, with the forms the pipeline computed for it. */
export interface AnswerCandidate {
  entityId: string;
  popularity: number;
  /** Matching forms of the full names and aliases (07 §5.7). */
  searchForms: string[];
  nameWords: NameWord[];
}

/** How a typed text was judged; kept on the battle action to tune the tolerance (08 §5.3). */
export type TextMatch = 'EXACT' | 'TYPO' | 'OTHER_ENTITY' | 'NONE';

export type TypedTextJudgement =
  | { verdict: 'CORRECT'; entityId: string; match: 'EXACT' | 'TYPO' }
  | { verdict: 'WRONG'; entityId: string; match: 'OTHER_ENTITY' }
  | { verdict: 'WRONG'; entityId: null; match: 'NONE' }
  /** Blank after normalizing, or longer than `maxLength`: refused, no attempt used. */
  | { verdict: 'EMPTY' };

/** The forms an accepted answer can be typed as: full names, aliases and distinctive single words. */
export function listFormsOfCandidate(candidate: AnswerCandidate, rules: TypedAnswerRules): string[] {
  const words = candidate.nameWords
    .filter((word) => word.sharedBy <= rules.singleWordMaxSharedBy)
    .map((word) => word.form);
  return [...new Set([...candidate.searchForms, ...words])];
}

/** How many typos a form allows, by its letter count without spaces. */
export function countAllowedEditsForForm(form: string, rules: TypedAnswerRules): number {
  const letters = [...form.replaceAll(' ', '')].length;
  let allowed = 0;
  for (const step of rules.typoTolerance) if (letters >= step.fromLetters) allowed = step.edits;
  return allowed;
}

/**
 * Edits between two texts: a letter added, missing or changed, or two neighbours swapped, each counts as one
 * (optimal string alignment). Returns `maxEdits + 1` as soon as the answer is known to be larger.
 */
export function countEditsUpTo(a: string, b: string, maxEdits: number): number {
  const left = [...a];
  const right = [...b];
  if (Math.abs(left.length - right.length) > maxEdits) return maxEdits + 1;
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let edits = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        edits = Math.min(edits, beforePrevious[j - 2] + 1);
      }
      current.push(edits);
    }
    if (Math.min(...current) > maxEdits) return maxEdits + 1;
    beforePrevious = previous;
    previous = current;
  }
  return Math.min(previous[right.length], maxEdits + 1);
}

/**
 * The accepted answer the text is closest to within the typo tolerance, or null (08 §5.3). Ties go to an entity
 * not used yet (grid), then to the most popular one.
 */
export function findClosestAcceptedAnswer(
  text: string,
  candidates: readonly AnswerCandidate[],
  rules: TypedAnswerRules,
  usedEntityIds: readonly string[] = [],
): { entityId: string; edits: number } | null {
  const used = new Set(usedEntityIds);
  const matches = candidates.flatMap((candidate) => {
    const edits = Math.min(
      ...listFormsOfCandidate(candidate, rules).map((form) => {
        const allowed = countAllowedEditsForForm(form, rules);
        const found = countEditsUpTo(text, form, allowed);
        return found <= allowed ? found : Infinity;
      }),
    );
    return edits === Infinity ? [] : [{ candidate, edits }];
  });
  matches.sort(
    (a, b) =>
      a.edits - b.edits ||
      Number(used.has(a.candidate.entityId)) - Number(used.has(b.candidate.entityId)) ||
      b.candidate.popularity - a.candidate.popularity,
  );
  const best = matches[0];
  return best ? { entityId: best.candidate.entityId, edits: best.edits } : null;
}
