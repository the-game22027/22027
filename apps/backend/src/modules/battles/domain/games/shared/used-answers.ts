/** Entity ids already named in a round (08 §9.2). Order is kept: it is the order they were said in. */
export type UsedAnswers = readonly string[];

export const hasAnswerBeenUsed = (used: UsedAnswers, entityId: string): boolean => used.includes(entityId);

export const addUsedAnswer = (used: UsedAnswers, entityId: string): UsedAnswers =>
  used.includes(entityId) ? used : [...used, entityId];
