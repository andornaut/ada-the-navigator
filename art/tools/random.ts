// MT19937 with CPython's seeding, random(), uniform() and _randbelow(), so a seed gives the
// same sequence as Python's random.Random(seed) for non-negative integer seeds below 2**32.
export class Random {
  private readonly state = new Uint32Array(624);
  private index = 624;

  constructor(seed: number) {
    this.initGenrand(19650218);
    const key = [seed >>> 0];
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = this.state[i - 1]! ^ (this.state[i - 1]! >>> 30);
      this.state[i] = ((this.state[i]! ^ Math.imul(prev, 1664525)) + key[j]! + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        this.state[0] = this.state[623]!;
        i = 1;
      }
      if (j >= key.length) {
        j = 0;
      }
    }
    for (let k = 623; k > 0; k--) {
      const prev = this.state[i - 1]! ^ (this.state[i - 1]! >>> 30);
      this.state[i] = ((this.state[i]! ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        this.state[0] = this.state[623]!;
        i = 1;
      }
    }
    this.state[0] = 0x80000000;
  }

  private initGenrand(seed: number): void {
    this.state[0] = seed >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = this.state[i - 1]! ^ (this.state[i - 1]! >>> 30);
      this.state[i] = (Math.imul(prev, 1812433253) + i) >>> 0;
    }
    this.index = 624;
  }

  private uint32(): number {
    const mt = this.state;
    if (this.index >= 624) {
      for (let k = 0; k < 624; k++) {
        const y = (mt[k]! & 0x80000000) | (mt[(k + 1) % 624]! & 0x7fffffff);
        mt[k] = mt[(k + 397) % 624]! ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.index = 0;
    }
    let y = mt[this.index++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  // A double in [0, 1) from 53 random bits.
  random(): number {
    const a = this.uint32() >>> 5;
    const b = this.uint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  // An integer in [0, n) by rejection on bit_length(n) bits.
  below(n: number): number {
    const bits = 32 - Math.clz32(n);
    let r = this.uint32() >>> (32 - bits);
    while (r >= n) {
      r = this.uint32() >>> (32 - bits);
    }
    return r;
  }

  choice<T>(items: readonly T[]): T {
    return items[this.below(items.length)]!;
  }
}

// Python's round(): nearest integer, ties to even.
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) {
    return floor + 1;
  }
  if (diff < 0.5) {
    return floor;
  }
  return floor % 2 === 0 ? floor : floor + 1;
}
