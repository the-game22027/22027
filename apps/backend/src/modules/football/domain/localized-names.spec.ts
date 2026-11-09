import { localizedName } from './localized-names';

describe('localizedName', () => {
  it('uses the requested language', () => {
    expect(localizedName({ en: 'Liverpool', ar: 'ليفربول' }, 'ar')).toBe('ليفربول');
    expect(localizedName({ en: 'Liverpool', ar: 'ليفربول' }, 'en')).toBe('Liverpool');
  });

  it('falls back to English when a translation is missing', () => {
    expect(localizedName({ en: 'Liverpool' }, 'ar')).toBe('Liverpool');
  });
});
