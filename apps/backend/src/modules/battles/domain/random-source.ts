/** Randomness the domain can replay: a battle stores its seed, so a bot battle plays the same way again. */
export interface RandomSource {
  /** A number in [0, 1). */
  next(): number;
}

/** mulberry32: tiny, fast and good enough for game decisions (not for anything secret). */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }
}

/** An integer in [min, max], both included. */
export function randomIntegerBetween(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random.next() * (max - min + 1));
}
