/** When hints come out during a round (08 §9.2): the first at `firstAtMs`, then one every `everyMs`, at most `max`. */
export interface HintSchedule {
  firstAtMs: number;
  everyMs: number;
  max: number;
}

/** When hint number `hintsGiven + 1` is due, or null when every hint is out. */
export const findNextHintAt = (startedAt: Date, schedule: HintSchedule, hintsGiven: number): Date | null =>
  hintsGiven >= schedule.max
    ? null
    : new Date(startedAt.getTime() + schedule.firstAtMs + hintsGiven * schedule.everyMs);
