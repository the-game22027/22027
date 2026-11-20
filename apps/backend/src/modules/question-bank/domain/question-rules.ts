import type { KnownEntity } from './answer-catalog';
import {
  type AnswerKind,
  answerKindOfGame,
  type BundleQuestion,
  type EntityKind,
  type GameContent,
  type GridCriterion,
  localesOfQuestion,
  type SingleChoiceContent,
} from './question-content';

// Sanity bounds on stored text and shapes, not product rules: they stop a broken bundle from filling the UI.
// Product values (how many clues, steps or answers a game needs) are game config (08 §6).
export const MAX_QUESTION_TEXT_LENGTH = 300;
export const MAX_EXPLANATION_LENGTH = 600;
export const MAX_OPTION_TEXT_LENGTH = 100;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_STEP_TEXT_LENGTH = 120;
export const MIN_REVEAL_STEPS = 2;
export const MAX_REVEAL_STEPS = 40;
export const MIN_CAREER_SPELLS = 2;
export const MIN_CLUES = 2;
export const MAX_CLUE_TEXT_LENGTH = 200;
export const GRID_SIZE = 3;
export const AUCTION_LISTS_PER_ROUND = 3;
export const MAX_AUCTION_TITLE_LENGTH = 200;
export const MIN_VAULT_QUESTIONS = 2;
export const MAX_VAULT_QUESTIONS = 9;
export const MAX_VAULT_QUESTION_LENGTH = 300;
// A starting XI: football's rule, not a game setting.
export const LINEUP_STARTERS = 11;
export const MIN_HEX_SIZE = 3;
export const MAX_HEX_SIZE = 7;
// A bridge board is clubs per side: 3 (4 squares) up to 5 (16 squares); the played size is chosen in DEC-85.
export const MIN_BRIDGE_SIZE = 3;
export const MAX_BRIDGE_SIZE = 5;

/**
 * The two clubs of every line of a bridge board, numbered as the battle numbers them (08 §16.1): horizontal lines
 * row by row, then vertical lines row by row. `clubs` are row by row.
 */
export function listBridgeLineClubs<Club>(size: number, clubs: readonly Club[]): [Club, Club][] {
  const pairs: [Club, Club][] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) pairs.push([clubs[row * size + col], clubs[row * size + col + 1]]);
  }
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size; col++) pairs.push([clubs[row * size + col], clubs[(row + 1) * size + col]]);
  }
  return pairs;
}

const checkText = (problems: string[], field: string, value: string, maxLength: number): void => {
  if (value.trim() === '') problems.push(`${field} is empty`);
  else if (value.length > maxLength) problems.push(`${field} is longer than ${maxLength} characters`);
};

/** Every rule a question breaks without looking at the catalog. An empty list means the shape is valid. */
export function findQuestionProblems(question: BundleQuestion, knownCategories: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const { content } = question;
  const locales = localesOfQuestion(content);

  if (!knownCategories.has(content.category)) problems.push(`category "${content.category}" is not in the manifest`);
  if (!Number.isInteger(content.difficulty) || content.difficulty < 1 || content.difficulty > 5) {
    problems.push('difficulty must be an integer from 1 to 5');
  }
  if (locales.length === 0) problems.push('the question has no locales');

  if (content.type === 'SINGLE_CHOICE') problems.push(...findSingleChoiceProblems(content));
  else problems.push(...findGameShapeProblems(content));

  const unknownReviewed = question.reviewedLocales.filter((locale) => !locales.includes(locale));
  if (unknownReviewed.length > 0) {
    problems.push(`humanReviewed names locales the question does not have: ${unknownReviewed.join(', ')}`);
  }
  if (question.provenance.sources.length === 0) problems.push('provenance needs at least one source');
  return problems;
}

function findSingleChoiceProblems(content: SingleChoiceContent): string[] {
  const problems: string[] = [];
  const locales = localesOfQuestion(content);
  for (const locale of locales) {
    const localized = content.locales[locale];
    if (!localized) continue;
    checkText(problems, `${locale} text`, localized.text, MAX_QUESTION_TEXT_LENGTH);
    if (localized.explanation !== null) {
      checkText(problems, `${locale} explanation`, localized.explanation, MAX_EXPLANATION_LENGTH);
    }
  }

  const { options } = content;
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    problems.push(`a question needs ${MIN_OPTIONS} to ${MAX_OPTIONS} options`);
  }
  const positions = options.map((option) => option.position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index + 1)) {
    problems.push('option positions must be 1, 2, 3, ... without gaps or repeats');
  }
  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) problems.push(`exactly one option must be correct, found ${correctCount}`);

  for (const option of options) {
    const optionLocales = Object.keys(option.locales).sort();
    if (optionLocales.join() !== locales.join()) {
      problems.push(`option ${option.position} must have text in exactly these locales: ${locales.join(', ')}`);
    }
  }
  for (const locale of locales) {
    const normalized: string[] = [];
    for (const option of options) {
      const text = option.locales[locale];
      if (text === undefined) continue;
      checkText(problems, `option ${option.position} ${locale} text`, text, MAX_OPTION_TEXT_LENGTH);
      normalized.push(text.trim().toLocaleLowerCase(locale));
    }
    if (new Set(normalized).size !== normalized.length) problems.push(`two options have the same ${locale} text`);
  }
  return problems;
}

function findGameShapeProblems(content: GameContent): string[] {
  const problems: string[] = [];
  const { body, answers } = content;
  const slots = answers.map((answer) => answer.slot);
  for (const slot of findRepeatedValues(slots.map(String))) problems.push(`answer slot ${slot} is listed twice`);
  for (const answer of answers) {
    if (findRepeatedValues(answer.entities).length > 0) problems.push(`answer slot ${answer.slot} repeats an entity`);
  }

  switch (body.gameType) {
    case 'BUZZER': {
      const stepCounts = Object.entries(body.steps).map(([locale, steps]) => [locale, steps.length] as const);
      const counts = new Set(stepCounts.map(([, count]) => count));
      if (counts.size > 1) {
        problems.push(
          `every locale needs the same number of steps, got ${stepCounts.map(([l, c]) => `${l}: ${c}`).join(', ')}`,
        );
      }
      for (const [locale, steps] of Object.entries(body.steps)) {
        if (steps.length < MIN_REVEAL_STEPS || steps.length > MAX_REVEAL_STEPS) {
          problems.push(`${locale} needs ${MIN_REVEAL_STEPS} to ${MAX_REVEAL_STEPS} steps`);
        }
        steps.forEach((step, index) => checkText(problems, `${locale} step ${index + 1}`, step, MAX_STEP_TEXT_LENGTH));
      }
      for (const [locale, explanation] of Object.entries(body.explanation ?? {})) {
        checkText(problems, `${locale} explanation`, explanation, MAX_EXPLANATION_LENGTH);
      }
      if (body.answerKind === 'NUMBER') {
        if (body.answerNumber === null) problems.push('a NUMBER answer needs answerNumber');
        if (answers.length > 0) problems.push('a NUMBER answer takes no answer entities');
      } else {
        if (body.answerNumber !== null) problems.push(`answerNumber is only for NUMBER answers`);
        problems.push(...findSingleSlotProblems(answers));
      }
      break;
    }
    case 'CAREER': {
      if (body.spells.length < MIN_CAREER_SPELLS) problems.push(`a career needs at least ${MIN_CAREER_SPELLS} spells`);
      body.spells.forEach((spell, index) => {
        if (spell.toYear !== null && spell.toYear < spell.fromYear) {
          problems.push(`spell ${index + 1} ends before it starts`);
        }
        const previous = body.spells[index - 1];
        if (previous && spell.fromYear < previous.fromYear) problems.push(`spell ${index + 1} is out of date order`);
      });
      problems.push(...findAnswerIsThePlayerProblems(answers, body.player));
      break;
    }
    case 'WHO_IS_PLAYER': {
      if (body.clues.length < MIN_CLUES) problems.push(`a player needs at least ${MIN_CLUES} clues`);
      const locales = Object.keys(body.clues[0]?.text ?? {})
        .sort()
        .join();
      body.clues.forEach((clue, index) => {
        if (Object.keys(clue.text).sort().join() !== locales) {
          problems.push(`clue ${index + 1} must have text in exactly the locales of clue 1`);
        }
        for (const [locale, text] of Object.entries(clue.text)) {
          checkText(problems, `clue ${index + 1} ${locale} text`, text, MAX_CLUE_TEXT_LENGTH);
        }
      });
      problems.push(...findAnswerIsThePlayerProblems(answers, body.player));
      break;
    }
    case 'GRID': {
      if (body.rows.length !== GRID_SIZE || body.cols.length !== GRID_SIZE) {
        problems.push(`a grid needs ${GRID_SIZE} rows and ${GRID_SIZE} columns`);
      }
      const criteria = [...body.rows, ...body.cols].map((criterion) => `${criterion.kind}:${criterion.entity}`);
      if (findRepeatedValues(criteria).length > 0) problems.push('a grid repeats a criterion');
      const cellCount = GRID_SIZE * GRID_SIZE;
      for (let cell = 0; cell < cellCount; cell += 1) {
        const answer = answers.find((slot) => slot.slot === cell);
        if (!answer || answer.entities.length === 0) problems.push(`grid cell ${cell} has no valid player`);
      }
      if (answers.some((answer) => answer.slot < 0 || answer.slot >= cellCount)) {
        problems.push(`grid answer slots must be 0 to ${cellCount - 1}`);
      }
      break;
    }
    case 'AUCTION': {
      if (body.lists.length !== AUCTION_LISTS_PER_ROUND) {
        problems.push(`an auction round offers ${AUCTION_LISTS_PER_ROUND} lists`);
      }
      const locales = Object.keys(body.lists[0]?.title ?? {})
        .sort()
        .join();
      body.lists.forEach((list, index) => {
        if (Object.keys(list.title).sort().join() !== locales) {
          problems.push(`list ${index + 1} must have a title in exactly the locales of list 1`);
        }
        for (const [locale, title] of Object.entries(list.title)) {
          checkText(problems, `list ${index + 1} ${locale} title`, title, MAX_AUCTION_TITLE_LENGTH);
        }
        const answer = answers.find((slot) => slot.slot === index);
        if (!answer || answer.entities.length === 0) problems.push(`auction list ${index + 1} has no names`);
      });
      if (answers.some((answer) => answer.slot < 0 || answer.slot >= AUCTION_LISTS_PER_ROUND)) {
        problems.push(`auction answer slots must be 0 to ${AUCTION_LISTS_PER_ROUND - 1}`);
      }
      break;
    }
    case 'HEX': {
      if (!Number.isInteger(body.size) || body.size < MIN_HEX_SIZE || body.size > MAX_HEX_SIZE) {
        problems.push(`a hex board is ${MIN_HEX_SIZE} to ${MAX_HEX_SIZE} cells wide`);
        break;
      }
      if (body.cells.length !== body.size * body.size)
        problems.push(`a hex board of size ${body.size} has ${body.size ** 2} cells`);
      const perCell = body.cells[0]?.questions.length ?? 0;
      const locales = Object.keys(body.cells[0]?.letter ?? {})
        .sort()
        .join();
      body.cells.forEach((cell, index) => {
        if (cell.questions.length === 0 || cell.questions.length !== perCell) {
          problems.push(`hex cell ${index + 1} must have ${perCell || 'at least one'} questions, like cell 1`);
        }
        if (Object.keys(cell.letter).sort().join() !== locales) {
          problems.push(`hex cell ${index + 1} must have a letter in exactly the locales of cell 1`);
        }
        for (const [locale, letter] of Object.entries(cell.letter)) {
          if ([...letter].length !== 1) problems.push(`hex cell ${index + 1} ${locale} letter must be one character`);
        }
        cell.questions.forEach((question, questionIndex) => {
          for (const [locale, title] of Object.entries(question.title)) {
            checkText(
              problems,
              `hex cell ${index + 1} question ${questionIndex + 1} ${locale} title`,
              title,
              MAX_AUCTION_TITLE_LENGTH,
            );
          }
          const slot = index * perCell + questionIndex;
          const answer = answers.find((candidate) => candidate.slot === slot);
          if (!answer || answer.entities.length === 0) problems.push(`hex slot ${slot} has no names`);
        });
      });
      if (answers.some((answer) => answer.slot < 0 || answer.slot >= body.cells.length * perCell)) {
        problems.push(`hex answer slots must be 0 to ${body.cells.length * perCell - 1}`);
      }
      break;
    }
    case 'LINEUP': {
      for (const [locale, title] of Object.entries(body.title)) {
        checkText(problems, `lineup ${locale} title`, title, MAX_QUESTION_TEXT_LENGTH);
      }
      const starters = body.slots.map((slot) => slot.player);
      if (body.slots.length !== LINEUP_STARTERS) problems.push(`a lineup has ${LINEUP_STARTERS} slots`);
      for (const repeated of findRepeatedValues(starters)) problems.push(`${repeated} starts in two slots`);
      if (body.slots.filter((slot) => slot.captain).length > 1) problems.push('a lineup has at most one captain');
      if (starters.includes(body.fake)) problems.push('the fake must not be a starter');
      if (!body.shown.includes(body.fake)) problems.push('the fake must be one of the shown names');
      for (const repeated of findRepeatedValues(body.shown)) problems.push(`${repeated} is shown twice`);
      for (const name of body.shown) {
        if (name !== body.fake && !starters.includes(name)) problems.push(`shown name ${name} is not a starter`);
      }
      const xi = answers.find((answer) => answer.slot === 0)?.entities ?? [];
      const fakes = answers.find((answer) => answer.slot === 1)?.entities ?? [];
      if (xi.length !== starters.length || starters.some((player) => !xi.includes(player))) {
        problems.push('lineup slot 0 must hold exactly the starters');
      }
      if (fakes.length !== 1 || fakes[0] !== body.fake) problems.push('lineup slot 1 must hold exactly the fake');
      if (answers.some((answer) => answer.slot !== 0 && answer.slot !== 1)) {
        problems.push('lineup answer slots are 0 (the XI) and 1 (the fake)');
      }
      break;
    }
    case 'ONE_TWO': {
      if (answers.length > 0) problems.push('a one-two seed has no answer slots: its answers come from the link graph');
      break;
    }
    case 'BRIDGE': {
      if (!Number.isInteger(body.size) || body.size < MIN_BRIDGE_SIZE || body.size > MAX_BRIDGE_SIZE) {
        problems.push(`a bridge board is ${MIN_BRIDGE_SIZE} to ${MAX_BRIDGE_SIZE} clubs wide`);
      } else if (body.clubs.length !== body.size * body.size) {
        problems.push(`a bridge board of size ${body.size} has ${body.size ** 2} clubs`);
      }
      for (const club of findRepeatedValues(body.clubs)) problems.push(`club ${club} appears twice on the board`);
      if (answers.length > 0) problems.push('a bridge board has no answer slots: its answers come from the link graph');
      break;
    }
    case 'VAULT': {
      if (body.questions.length < MIN_VAULT_QUESTIONS || body.questions.length > MAX_VAULT_QUESTIONS) {
        problems.push(`a vault has ${MIN_VAULT_QUESTIONS} to ${MAX_VAULT_QUESTIONS} questions`);
      }
      const locales = Object.keys(body.questions[0]?.text ?? {})
        .sort()
        .join();
      body.questions.forEach((question, index) => {
        if (Object.keys(question.text).sort().join() !== locales) {
          problems.push(`vault question ${index + 1} must have text in exactly the locales of question 1`);
        }
        for (const [locale, text] of Object.entries(question.text)) {
          checkText(problems, `vault question ${index + 1} ${locale} text`, text, MAX_VAULT_QUESTION_LENGTH);
        }
        if (question.answerNumber < 0 || question.answerNumber > 9) {
          problems.push(`vault question ${index + 1} answer must be a digit 0-9`);
        }
      });
      if (answers.length > 0) problems.push('a vault has no answer slots: its digits are in the questions');
      break;
    }
    case 'MINES': {
      const [club, second, ...extra] = body.criteria;
      if (club?.kind !== 'CLUB' || !second || second.kind === 'CLUB' || extra.length > 0) {
        problems.push('a mines category is a CLUB criterion plus one NATIONALITY or DECADE criterion');
      }
      if (second?.kind === 'DECADE' && (!Number.isInteger(second.fromYear) || second.fromYear % 10 !== 0)) {
        problems.push('a DECADE criterion starts at a year ending in 0');
      }
      problems.push(...findSingleSlotProblems(answers));
      break;
    }
  }
  return problems;
}

function findSingleSlotProblems(answers: GameContent['answers']): string[] {
  if (answers.length !== 1 || answers[0].slot !== 0 || answers[0].entities.length === 0) {
    return ['answers must be exactly one slot 0 with at least one entity'];
  }
  return [];
}

function findAnswerIsThePlayerProblems(answers: GameContent['answers'], player: string): string[] {
  const problems = findSingleSlotProblems(answers);
  if (problems.length === 0 && !answers[0].entities.includes(player)) {
    problems.push('the player must be one of the accepted answers');
  }
  return problems;
}

const GRID_CRITERION_KIND: Record<GridCriterion['kind'], EntityKind> = {
  CLUB: 'CLUB',
  NATIONALITY: 'COUNTRY',
  COMPETITION_WON: 'COMPETITION',
};

/**
 * Checks every entity a game points at against the catalog: it must exist and be of the right kind.
 * Buzzer answers must also not be given away by the question text.
 */
export function findCatalogReferenceProblems(
  content: GameContent,
  findEntity: (externalRef: string) => KnownEntity | undefined,
): string[] {
  const problems: string[] = [];
  const expect = (externalRef: string, kind: EntityKind | AnswerKind, role: string): void => {
    const entity = findEntity(externalRef);
    if (!entity) problems.push(`${role} ${externalRef} is not in the answer catalog`);
    else if (entity.kind !== kind) problems.push(`${role} ${externalRef} is a ${entity.kind}, expected ${kind}`);
  };

  const { body } = content;
  const answerKind = answerKindOfGame(body);
  for (const answer of content.answers) {
    for (const entity of answer.entities) expect(entity, answerKind, `answer (slot ${answer.slot})`);
  }
  switch (body.gameType) {
    case 'BUZZER':
      for (const answer of content.answers) {
        for (const externalRef of answer.entities) {
          const entity = findEntity(externalRef);
          if (!entity) continue;
          for (const [locale, steps] of Object.entries(body.steps)) {
            const name = entity.names[locale as 'en' | 'ar'];
            if (name && steps.join(' ').toLocaleLowerCase(locale).includes(name.toLocaleLowerCase(locale))) {
              problems.push(`the ${locale} question gives away the answer "${name}"`);
            }
          }
        }
      }
      break;
    case 'CAREER':
      expect(body.player, 'PLAYER', 'player');
      body.spells.forEach((spell, index) => expect(spell.club, 'CLUB', `spell ${index + 1} club`));
      break;
    case 'WHO_IS_PLAYER':
      expect(body.player, 'PLAYER', 'player');
      break;
    case 'GRID':
      for (const criterion of [...body.rows, ...body.cols]) {
        expect(criterion.entity, GRID_CRITERION_KIND[criterion.kind], `${criterion.kind} criterion`);
      }
      break;
    case 'MINES':
      for (const criterion of body.criteria) {
        if ('entity' in criterion) {
          expect(criterion.entity, GRID_CRITERION_KIND[criterion.kind], `${criterion.kind} criterion`);
        }
      }
      break;
    case 'ONE_TWO': {
      // A seed is a ball: a player or a club, the two kinds the link graph starts from (08 §15.4).
      const seed = findEntity(body.seed);
      if (!seed) problems.push(`seed ${body.seed} is not in the answer catalog`);
      else if (seed.kind !== 'PLAYER' && seed.kind !== 'CLUB')
        problems.push(`seed ${body.seed} is a ${seed.kind}, expected PLAYER or CLUB`);
      break;
    }
    case 'BRIDGE':
      body.clubs.forEach((club, index) => expect(club, 'CLUB', `board club ${index + 1}`));
      break;
  }
  return problems;
}

/** Values that appear more than once, each listed once. */
export function findRepeatedValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}
