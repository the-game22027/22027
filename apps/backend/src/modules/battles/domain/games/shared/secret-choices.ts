import type { ParticipantId } from '../game-rules';
import type { RandomSource } from '../../random-source';

/** One hidden pick; `auto` when the server made it for a player who ran out of time. */
export interface SecretChoice {
  entityId: string;
  auto: boolean;
}

/** Each player's hidden picks before play, up to `count` each (08 §9.2). Never sent to another player. */
export interface SecretChoices {
  count: number;
  byParticipant: Readonly<Record<ParticipantId, readonly SecretChoice[]>>;
}

export type SecretChoiceRejection = 'ALL_CHOSEN' | 'ALREADY_CHOSEN';

export const startSecretChoices = (participants: readonly ParticipantId[], count: number): SecretChoices => ({
  count,
  byParticipant: Object.fromEntries(participants.map((id) => [id, []])),
});

export const choicesOf = (choices: SecretChoices, who: ParticipantId): readonly SecretChoice[] =>
  choices.byParticipant[who] ?? [];

export function findSecretChoiceRejection(
  choices: SecretChoices,
  who: ParticipantId,
  entityId: string | null,
): SecretChoiceRejection | null {
  const own = choicesOf(choices, who);
  if (own.length >= choices.count) return 'ALL_CHOSEN';
  if (entityId !== null && own.some((choice) => choice.entityId === entityId)) return 'ALREADY_CHOSEN';
  return null;
}

export const addSecretChoice = (choices: SecretChoices, who: ParticipantId, entityId: string): SecretChoices => ({
  ...choices,
  byParticipant: { ...choices.byParticipant, [who]: [...choicesOf(choices, who), { entityId, auto: false }] },
});

export const hasEveryoneChosen = (choices: SecretChoices): boolean =>
  Object.values(choices.byParticipant).every((own) => own.length >= choices.count);

/** Fills every player's empty slots from `candidates` with the random source, skipping their own picks. */
export function fillMissingSecretChoices(
  choices: SecretChoices,
  candidates: readonly string[],
  random: RandomSource,
): SecretChoices {
  const byParticipant: Record<ParticipantId, readonly SecretChoice[]> = {};
  for (const [who, own] of Object.entries(choices.byParticipant)) {
    const filled = [...own];
    const left = candidates.filter((id) => !own.some((choice) => choice.entityId === id));
    while (filled.length < choices.count && left.length > 0) {
      const [entityId] = left.splice(Math.floor(random.next() * left.length), 1);
      filled.push({ entityId, auto: true });
    }
    byParticipant[who] = filled;
  }
  return { ...choices, byParticipant };
}
