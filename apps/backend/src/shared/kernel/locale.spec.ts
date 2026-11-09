import { localeFromHeader } from './locale';

describe('localeFromHeader', () => {
  it.each([
    ['ar', 'ar'],
    ['en-GB', 'en'],
    ['fr-FR,ar-EG;q=0.8,en;q=0.5', 'ar'],
    ['EN', 'en'],
  ])('reads %s as %s', (header, expected) => {
    expect(localeFromHeader(header)).toBe(expected);
  });

  it.each([undefined, '', 'fr', '*'])('finds nothing supported in %s', (header) => {
    expect(localeFromHeader(header)).toBeNull();
  });
});
