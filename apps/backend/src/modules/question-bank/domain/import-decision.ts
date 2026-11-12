import type { Locale } from '@shared/kernel';

export type QuestionStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'DISABLED';

/** The newest stored version of an external key, as far as importing cares. */
export interface LatestQuestionVersion {
  id: string;
  keyVersion: number;
  contentHash: string;
  status: QuestionStatus;
  wasEverPublished: boolean;
  locales: Locale[];
  reviewedLocales: Locale[];
}

export interface IncomingQuestion {
  contentHash: string;
  locales: Locale[];
  reviewedLocales: Locale[];
}

export type ImportDecision =
  | { action: 'INSERT'; status: QuestionStatus }
  | { action: 'UNCHANGED'; questionId: string }
  | { action: 'RECORD_REVIEWS'; questionId: string; newlyReviewedLocales: Locale[]; approve: boolean }
  | { action: 'REPLACE_CONTENT'; questionId: string; keyVersion: number; status: QuestionStatus }
  | { action: 'INSERT_NEW_VERSION'; keyVersion: number; status: QuestionStatus; disableQuestionId: string | null };

/** A question is ready to publish only when a human reviewed every one of its locales. */
export function statusFromReviews(locales: readonly Locale[], reviewedLocales: readonly Locale[]): QuestionStatus {
  return locales.every((locale) => reviewedLocales.includes(locale)) ? 'APPROVED' : 'DRAFT';
}

/** What importing one bundle question does to the stored data (docs/architecture/07 §5.5). */
export function decideImportAction(latest: LatestQuestionVersion | null, incoming: IncomingQuestion): ImportDecision {
  const incomingStatus = statusFromReviews(incoming.locales, incoming.reviewedLocales);
  if (!latest) return { action: 'INSERT', status: incomingStatus };

  if (latest.contentHash === incoming.contentHash) {
    const newlyReviewedLocales = incoming.reviewedLocales.filter((locale) => !latest.reviewedLocales.includes(locale));
    if (newlyReviewedLocales.length === 0) return { action: 'UNCHANGED', questionId: latest.id };
    const reviewedAfter = [...latest.reviewedLocales, ...newlyReviewedLocales];
    const approve = latest.status === 'DRAFT' && statusFromReviews(latest.locales, reviewedAfter) === 'APPROVED';
    return { action: 'RECORD_REVIEWS', questionId: latest.id, newlyReviewedLocales, approve };
  }

  const neverServable = !latest.wasEverPublished && (latest.status === 'DRAFT' || latest.status === 'APPROVED');
  if (neverServable) {
    return { action: 'REPLACE_CONTENT', questionId: latest.id, keyVersion: latest.keyVersion, status: incomingStatus };
  }

  return {
    action: 'INSERT_NEW_VERSION',
    keyVersion: latest.keyVersion + 1,
    status: incomingStatus,
    disableQuestionId: latest.status === 'DISABLED' ? null : latest.id,
  };
}
