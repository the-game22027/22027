/**
 * Source of "now" for domain and application code. Never call `new Date()` / `Date.now()` there:
 * inject a Clock so tests control time. Time-critical locks still use the database clock (ADR-0009).
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Test clock: returns a fixed instant until moved explicitly. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date | string) {
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
