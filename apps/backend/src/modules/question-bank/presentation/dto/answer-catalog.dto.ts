import type { EntityKind } from '../../domain/question-content';

export class LocalizedEntityNamesDto {
  en!: string;
  ar!: string;
}

export class AnswerCatalogEntityDto {
  id!: string;
  /** One of ENTITY_KINDS; clients must tolerate unknown values. */
  kind!: EntityKind;
  names!: LocalizedEntityNamesDto;
  /** Normalized names and aliases (07 §5.7): what the app searches while the player types. */
  search!: string[];
  popularity!: number;
}

/** Every entity a typed answer can be (08 §5.5). Served with an ETag; the app revalidates its copy. */
export class AnswerCatalogDto {
  version!: string;
  entities!: AnswerCatalogEntityDto[];
}
