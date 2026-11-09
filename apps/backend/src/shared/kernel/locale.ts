export const LOCALES = ['ar', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** First supported language in an Accept-Language header; `ar-EG` counts as `ar`. */
export function localeFromHeader(header: string | undefined): Locale | null {
  for (const part of header?.split(',') ?? []) {
    const language = part.split(';')[0]?.split('-')[0]?.trim().toLowerCase() ?? '';
    if (isLocale(language)) return language;
  }
  return null;
}
