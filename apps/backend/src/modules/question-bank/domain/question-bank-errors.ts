import { DomainError } from '@shared/kernel';

const MAX_LISTED_PROBLEMS = 50;

export class InvalidBundleError extends DomainError {
  readonly code = 'QUESTION_BUNDLE_INVALID';
  readonly kind = 'VALIDATION';

  constructor(readonly problems: readonly string[]) {
    const listed = problems.slice(0, MAX_LISTED_PROBLEMS);
    const more = problems.length - listed.length;
    super(
      [
        'The bundle was not imported:',
        ...listed.map((problem) => `- ${problem}`),
        ...(more > 0 ? [`- ...and ${more} more`] : []),
      ].join('\n'),
    );
  }
}

export class BundleVersionReusedError extends DomainError {
  readonly code = 'QUESTION_BUNDLE_VERSION_REUSED';
  readonly kind = 'CONFLICT';

  constructor(bundleVersion: string) {
    super(
      `Bundle version ${bundleVersion} was already imported with different content. Give the new bundle a new version.`,
    );
  }
}

export class QuestionNotFoundError extends DomainError {
  readonly code = 'QUESTION_NOT_FOUND';
  readonly kind = 'NOT_FOUND';

  constructor(questionId: string) {
    super(`No question has id ${questionId}.`);
  }
}

export class BundleNotImportedError extends DomainError {
  readonly code = 'QUESTION_BUNDLE_NOT_IMPORTED';
  readonly kind = 'NOT_FOUND';

  constructor(bundleVersion: string) {
    super(`Bundle ${bundleVersion} was never imported. Import it with questions:import first.`);
  }
}

export class InvalidDisableReasonError extends DomainError {
  readonly code = 'QUESTION_DISABLE_REASON_INVALID';
  readonly kind = 'VALIDATION';

  constructor(maxLength: number) {
    super(`A disable reason is required, at most ${maxLength} characters.`);
  }
}

export class InvalidReportReasonError extends DomainError {
  readonly code = 'INVALID_REPORT_REASON';
  readonly kind = 'VALIDATION';

  constructor(maxLength: number) {
    super(`A report reason is 1 to ${String(maxLength)} characters of text.`);
  }
}
