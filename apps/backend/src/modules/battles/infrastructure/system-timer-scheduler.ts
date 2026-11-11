import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/kernel';
import type { ScheduledTimer, TimerScheduler } from '../application/ports/timer-scheduler';

/** setTimeout measured against the injected clock. Fine for one process; P6.3 adds ownership for several. */
@Injectable()
export class SystemTimerScheduler implements TimerScheduler {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  runAt(at: Date, task: () => void): ScheduledTimer {
    const handle = setTimeout(task, Math.max(0, at.getTime() - this.clock.now().getTime()));
    return { cancel: () => clearTimeout(handle) };
  }
}
