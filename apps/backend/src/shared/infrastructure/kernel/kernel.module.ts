import { Global, Module } from '@nestjs/common';
import { CLOCK, ID_GENERATOR, SystemClock, UuidV7Generator } from '@shared/kernel';

/** Binds the kernel ports (time, ids) for the whole app. Tests override them with fakes. */
@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: new SystemClock() },
    { provide: ID_GENERATOR, useValue: new UuidV7Generator() },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class KernelModule {}
