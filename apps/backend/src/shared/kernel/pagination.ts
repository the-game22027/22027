/** Keyset (cursor) pagination shared by every list endpoint (docs/api/API.md §2). */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export interface PageRequest {
  limit: number;
  /** Opaque cursor returned by the previous page; absent for the first page. */
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}

/** Cursors are base64url JSON so clients cannot depend on their shape. */
export function encodeCursor(position: Readonly<Record<string, unknown>>): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeCursor<T extends Record<string, unknown>>(cursor: string): T | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}
