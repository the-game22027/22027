/** True when an `If-None-Match` header names this ETag (or `*`); weak validators count, as RFC 9110 says for GET. */
export function ifNoneMatchIncludesETag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === '*' || tag === etag);
}

/** True when an `Accept-Encoding` header accepts gzip; `gzip;q=0` means "not gzip", and an explicit gzip beats `*`. */
export function acceptsGzipEncoding(header: string | undefined): boolean {
  const qualityByCoding = new Map<string, number>();
  for (const part of header?.split(',') ?? []) {
    const [coding = '', ...parameters] = part.split(';').map((piece) => piece.trim().toLowerCase());
    const quality = parameters.find((parameter) => parameter.startsWith('q='));
    qualityByCoding.set(coding, quality === undefined ? 1 : Number(quality.slice(2)));
  }
  const quality = qualityByCoding.get('gzip') ?? qualityByCoding.get('*') ?? 0;
  return quality > 0;
}
