import { randomBytes } from 'node:crypto';

/**
 * UUID v7 (RFC 9562): 48-bit Unix milliseconds + version + 12-bit counter + variant + 62 random bits.
 * Time-ordered ids give good index locality. Within one millisecond the 12-bit counter keeps ids
 * strictly increasing (RFC 9562 §6.2 method 1); if it overflows, the timestamp is advanced by 1 ms.
 */
export interface IdGenerator {
  next(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

const COUNTER_MAX = 0xfff;

export class UuidV7Generator implements IdGenerator {
  private lastMs = -1;
  private counter = 0;

  constructor(private readonly nowMs: () => number = Date.now) {}

  next(): string {
    let ms = this.nowMs();
    if (ms <= this.lastMs) {
      ms = this.lastMs;
      if (this.counter < COUNTER_MAX) {
        this.counter += 1;
      } else {
        ms += 1;
        this.counter = this.randomCounterSeed();
      }
    } else {
      this.counter = this.randomCounterSeed();
    }
    this.lastMs = ms;
    return format(ms, this.counter, randomBytes(8));
  }

  /** Start each millisecond in the lower half of the range so there is room to increment. */
  private randomCounterSeed(): number {
    return randomBytes(2).readUInt16BE(0) & 0x7ff;
  }
}

function format(ms: number, counter: number, random: Buffer): string {
  const bytes = Buffer.alloc(16);
  bytes.writeUIntBE(ms, 0, 6);
  bytes[6] = 0x70 | (counter >> 8); // version 7 + counter high bits
  bytes[7] = counter & 0xff;
  random.copy(bytes, 8);
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 9562 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}
