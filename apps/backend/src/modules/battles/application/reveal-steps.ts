import type { EngineGameBody } from '@modules/question-bank';
import type { Locale } from '@shared/kernel';

type Names = ReadonlyMap<string, { en: string; ar: string }>;

const WORDS: Record<Locale, { present: string; loan: string; separator: string }> = {
  en: { present: 'present', loan: 'loan', separator: ', ' },
  ar: { present: 'حتى الآن', loan: 'إعارة', separator: '، ' },
};

/** Catalog entities whose names appear in the steps; the engine loads their names once per round. */
export function listEntityIdsShownInSteps(body: EngineGameBody): string[] {
  return body.gameType === 'CAREER' ? body.spells.map((spell) => spell.clubEntityId) : [];
}

/**
 * The text of every reveal step in one locale (08 §3.1): Buzzer steps and Who-is-the-player clues as written,
 * Career spells rendered from catalog names, e.g. `Sporting CP (2002–2003)`.
 */
export function revealStepsForLocale(
  body: EngineGameBody,
  names: Names,
  locale: Locale,
  { showYears }: { showYears: boolean },
): string[] {
  switch (body.gameType) {
    case 'BUZZER':
      return body.steps[locale] ?? [];
    case 'WHO_IS_PLAYER':
      return body.clues.map((clue) => clue.text[locale] ?? '');
    case 'CAREER': {
      const words = WORDS[locale];
      return body.spells.map((spell) => {
        const club = names.get(spell.clubEntityId)?.[locale] ?? '';
        const details = [
          ...(showYears
            ? [`${String(spell.fromYear)}–${spell.toYear === null ? words.present : String(spell.toYear)}`]
            : []),
          ...(spell.loan ? [words.loan] : []),
        ];
        return details.length > 0 ? `${club} (${details.join(words.separator)})` : club;
      });
    }
    case 'GRID':
    case 'MINES':
    case 'AUCTION':
      throw new Error(`A ${body.gameType} round has no reveal steps`);
  }
}
