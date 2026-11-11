export const TIMER_SCHEDULER = Symbol('TIMER_SCHEDULER');

export interface ScheduledTimer {
  cancel(): void;
}

/** Runs a task at a given instant of the injected clock; tests swap it for a controllable one. */
export interface TimerScheduler {
  runAt(at: Date, task: () => void): ScheduledTimer;
}
