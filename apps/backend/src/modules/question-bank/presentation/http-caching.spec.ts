import { acceptsGzipEncoding, ifNoneMatchIncludesETag } from './http-caching';

describe('If-None-Match', () => {
  it.each([
    ['"v1"', true],
    ['W/"v1"', true],
    ['"v0", "v1"', true],
    ['*', true],
    ['"v2"', false],
    [undefined, false],
  ])('%s matches "v1": %s', (header, expected) => {
    expect(ifNoneMatchIncludesETag(header, '"v1"')).toBe(expected);
  });
});

describe('Accept-Encoding', () => {
  it.each([
    ['gzip, deflate, br', true],
    ['GZIP', true],
    ['br;q=1.0, gzip;q=0.8', true],
    ['*', true],
    ['gzip;q=0', false],
    ['*;q=0, gzip', true],
    ['identity', false],
    [undefined, false],
  ])('%s accepts gzip: %s', (header, expected) => {
    expect(acceptsGzipEncoding(header)).toBe(expected);
  });
});
