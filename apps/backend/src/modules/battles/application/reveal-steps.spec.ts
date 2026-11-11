import type { EngineGameBody } from '@modules/question-bank';
import { listEntityIdsShownInSteps, revealStepsForLocale } from './reveal-steps';

const names = new Map([
  ['sporting', { en: 'Sporting CP', ar: 'سبورتينغ لشبونة' }],
  ['preston', { en: 'Preston North End', ar: 'بريستون نورث إيند' }],
  ['nassr', { en: 'Al-Nassr', ar: 'النصر' }],
]);

const career: EngineGameBody = {
  gameType: 'CAREER',
  playerEntityId: 'ronaldo',
  spells: [
    { clubEntityId: 'sporting', fromYear: 2002, toYear: 2003, loan: false },
    { clubEntityId: 'preston', fromYear: 1994, toYear: 1995, loan: true },
    { clubEntityId: 'nassr', fromYear: 2023, toYear: null, loan: false },
  ],
};

describe('reveal steps per locale', () => {
  it('renders a career with years, loans and an open last spell, in both languages', () => {
    expect(revealStepsForLocale(career, names, 'en', { showYears: true })).toEqual([
      'Sporting CP (2002–2003)',
      'Preston North End (1994–1995, loan)',
      'Al-Nassr (2023–present)',
    ]);
    expect(revealStepsForLocale(career, names, 'ar', { showYears: true })).toEqual([
      'سبورتينغ لشبونة (2002–2003)',
      'بريستون نورث إيند (1994–1995، إعارة)',
      'النصر (2023–حتى الآن)',
    ]);
  });

  it('keeps only the club and the loan mark when years are hidden', () => {
    expect(revealStepsForLocale(career, names, 'en', { showYears: false })).toEqual([
      'Sporting CP',
      'Preston North End (loan)',
      'Al-Nassr',
    ]);
  });

  it('uses clues and buzzer steps as written', () => {
    const who: EngineGameBody = {
      gameType: 'WHO_IS_PLAYER',
      playerEntityId: 'ronaldo',
      clues: [
        { kind: 'BIRTH_YEAR', text: { en: 'Born in 1985', ar: 'من مواليد 1985' } },
        { kind: 'NATIONALITY', text: { en: 'Nationality: Portugal', ar: 'الجنسية: البرتغال' } },
      ],
    };
    expect(revealStepsForLocale(who, names, 'ar', { showYears: true })).toEqual([
      'من مواليد 1985',
      'الجنسية: البرتغال',
    ]);
    const buzzer: EngineGameBody = {
      gameType: 'BUZZER',
      answerKind: 'CLUB',
      steps: { en: ['Which club', 'won?'] },
      explanation: null,
      answerNumber: null,
    };
    expect(revealStepsForLocale(buzzer, names, 'en', { showYears: true })).toEqual(['Which club', 'won?']);
  });

  it('names the clubs a career shows, so they load in one query', () => {
    expect(listEntityIdsShownInSteps(career)).toEqual(['sporting', 'preston', 'nassr']);
  });
});
