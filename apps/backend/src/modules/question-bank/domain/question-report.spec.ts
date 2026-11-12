import { InvalidReportReasonError } from './question-bank-errors';
import { MAX_REPORT_REASON_LENGTH, normalizeReportReason } from './question-report';

describe('normalizeReportReason', () => {
  it('trims the reason', () => {
    expect(normalizeReportReason('  الإجابة غلط  ')).toBe('الإجابة غلط');
  });

  it('refuses a blank or too long reason', () => {
    expect(() => normalizeReportReason('   ')).toThrow(InvalidReportReasonError);
    expect(() => normalizeReportReason('x'.repeat(MAX_REPORT_REASON_LENGTH + 1))).toThrow(InvalidReportReasonError);
    expect(normalizeReportReason('x'.repeat(MAX_REPORT_REASON_LENGTH))).toHaveLength(MAX_REPORT_REASON_LENGTH);
  });
});
