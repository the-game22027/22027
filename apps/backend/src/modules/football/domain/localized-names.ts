import type { Locale } from '@shared/kernel';

export interface LocalizedNames {
  readonly en: string;
  readonly ar?: string;
}

export function localizedName(names: LocalizedNames, locale: Locale): string {
  return names[locale] ?? names.en;
}
