import type { AnswerKind, EntityKind } from './question-content';

/** How the server judges a typed answer (08 §5.3). */
export type TypedAnswerVerdict = 'CORRECT' | 'WRONG' | 'UNKNOWN_ENTITY';

export interface TypedAnswerFacts {
  /** Kind of the answered entity, or null when no such entity exists. */
  entityKind: EntityKind | null;
  roundAnswerKind: AnswerKind;
  isAcceptedForSlot: boolean;
}

export function judgeTypedAnswer({
  entityKind,
  roundAnswerKind,
  isAcceptedForSlot,
}: TypedAnswerFacts): TypedAnswerVerdict {
  if (entityKind === null || entityKind !== roundAnswerKind) return 'UNKNOWN_ENTITY';
  return isAcceptedForSlot ? 'CORRECT' : 'WRONG';
}
