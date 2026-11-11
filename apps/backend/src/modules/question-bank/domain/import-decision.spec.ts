import { decideImportAction, type IncomingQuestion, type LatestQuestionVersion } from './import-decision';

const incoming = (change: Partial<IncomingQuestion> = {}): IncomingQuestion => ({
  contentHash: 'sha256:new',
  locales: ['ar', 'en'],
  reviewedLocales: ['ar', 'en'],
  ...change,
});

const stored = (change: Partial<LatestQuestionVersion> = {}): LatestQuestionVersion => ({
  id: 'q1',
  keyVersion: 1,
  contentHash: 'sha256:old',
  status: 'APPROVED',
  wasEverPublished: false,
  locales: ['ar', 'en'],
  reviewedLocales: ['ar', 'en'],
  ...change,
});

describe('decideImportAction', () => {
  it('inserts a new key as APPROVED when every locale was reviewed', () => {
    expect(decideImportAction(null, incoming())).toEqual({ action: 'INSERT', status: 'APPROVED' });
  });

  it('inserts a new key as DRAFT when a locale was not reviewed', () => {
    expect(decideImportAction(null, incoming({ reviewedLocales: ['en'] }))).toEqual({
      action: 'INSERT',
      status: 'DRAFT',
    });
  });

  it('changes nothing when the content and reviews are the same', () => {
    expect(decideImportAction(stored({ contentHash: 'sha256:new' }), incoming())).toEqual({
      action: 'UNCHANGED',
      questionId: 'q1',
    });
  });

  it('never takes a review back', () => {
    const latest = stored({ contentHash: 'sha256:new' });
    expect(decideImportAction(latest, incoming({ reviewedLocales: [] }))).toEqual({
      action: 'UNCHANGED',
      questionId: 'q1',
    });
  });

  it('records a new review and approves the draft once every locale is reviewed', () => {
    const latest = stored({ contentHash: 'sha256:new', status: 'DRAFT', reviewedLocales: ['en'] });
    expect(decideImportAction(latest, incoming())).toEqual({
      action: 'RECORD_REVIEWS',
      questionId: 'q1',
      newlyReviewedLocales: ['ar'],
      approve: true,
    });
  });

  it('records a review without touching the status of a disabled question', () => {
    const latest = stored({ contentHash: 'sha256:new', status: 'DISABLED', reviewedLocales: ['en'] });
    expect(decideImportAction(latest, incoming())).toMatchObject({ action: 'RECORD_REVIEWS', approve: false });
  });

  it('replaces changed content of a question that was never published', () => {
    expect(decideImportAction(stored(), incoming({ reviewedLocales: ['en'] }))).toEqual({
      action: 'REPLACE_CONTENT',
      questionId: 'q1',
      keyVersion: 1,
      status: 'DRAFT',
    });
  });

  it.each([
    ['published', stored({ status: 'PUBLISHED', wasEverPublished: true })],
    ['published once and now approved again', stored({ status: 'APPROVED', wasEverPublished: true })],
  ])('adds a new version and disables the old one when it was %s', (_name, latest) => {
    expect(decideImportAction(latest, incoming())).toEqual({
      action: 'INSERT_NEW_VERSION',
      keyVersion: 2,
      status: 'APPROVED',
      disableQuestionId: 'q1',
    });
  });

  it('adds a new version next to an already disabled question without disabling it again', () => {
    expect(decideImportAction(stored({ status: 'DISABLED', keyVersion: 3 }), incoming())).toEqual({
      action: 'INSERT_NEW_VERSION',
      keyVersion: 4,
      status: 'APPROVED',
      disableQuestionId: null,
    });
  });
});
