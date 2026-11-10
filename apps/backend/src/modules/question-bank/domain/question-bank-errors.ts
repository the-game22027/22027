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
