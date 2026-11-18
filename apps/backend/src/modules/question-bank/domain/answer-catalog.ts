import type { EntityKind } from './question-content';

/** One entity of the answer catalog, as a bundle carries it (07 §5.4, 08 §5). */
export interface CatalogEntity {
  externalRef: string;
  kind: EntityKind;
  names: { en: string; ar: string };
  aliases: { en: string[]; ar: string[] };
  popularity: number;
  /** Normalized names and aliases, computed by the pipeline (07 §5.7); what typed text is judged against. */
  searchForms: string[];
  /** Single words of the names, with how many entities of the same kind have them (ADR-0021). */
  nameWords: NameWord[];
}

export interface NameWord {
  form: string;
  sharedBy: number;
}

/** What content checks need to know about an entity the content points at. */
export interface KnownEntity {
  kind: EntityKind;
  names: { en: string; ar: string };
}
