import { InvalidReportReasonError } from './question-bank-errors';

// A sanity bound so a reason stays a reason, not a document (08 §5.7).
export const MAX_REPORT_REASON_LENGTH = 500;

/** The reason as stored: trimmed, not blank, not too long. */
export function normalizeReportReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed === '' || [...trimmed].length > MAX_REPORT_REASON_LENGTH) {
    throw new InvalidReportReasonError(MAX_REPORT_REASON_LENGTH);
  }
  return trimmed;
}
