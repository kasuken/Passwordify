/**
 * Cryptographically secure password & passphrase generation.
 *
 * Every random choice is drawn from `crypto.getRandomValues` with rejection
 * sampling, so there is no modulo bias. (The previous version of this site used
 * `System.Random`, which is NOT cryptographically secure — that bug is fixed
 * here.)
 */

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';
const AMBIGUOUS = new Set(['l', 'I', '1', 'O', '0', 'o', 'B', '8', 'S', '5', 'Z', '2']);

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  /** Exclude visually confusable characters (l, I, 1, O, 0, …). */
  avoidAmbiguous: boolean;
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  /** Append a random digit to one word for extra entropy. */
  includeNumber: boolean;
}

/** Unbiased random integer in [0, max) using rejection sampling. */
function randomInt(max: number): number {
  if (max <= 0) throw new RangeError('max must be positive');
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

function pick<T>(arr: ArrayLike<T>): T {
  return arr[randomInt(arr.length)];
}

/** Fisher–Yates shuffle using the CSPRNG. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generatePassword(opts: PasswordOptions): string {
  const pools: string[] = [];
  if (opts.lowercase) pools.push(LOWER);
  if (opts.uppercase) pools.push(UPPER);
  if (opts.numbers) pools.push(DIGITS);
  if (opts.symbols) pools.push(SYMBOLS);
  if (pools.length === 0) pools.push(LOWER);

  const filtered = pools.map((set) =>
    opts.avoidAmbiguous
      ? [...set].filter((c) => !AMBIGUOUS.has(c)).join('')
      : set,
  );

  const all = filtered.join('');
  const length = Math.max(pools.length, opts.length);

  // Guarantee at least one character from every enabled pool…
  const chars: string[] = filtered.map((set) => pick(set));
  // …then fill the rest from the combined pool.
  for (let i = chars.length; i < length; i++) {
    chars.push(pick(all));
  }
  return shuffle(chars).join('');
}

/** Bits of entropy for a password drawn uniformly from the enabled pools. */
export function passwordEntropyBits(opts: PasswordOptions): number {
  let poolSize = 0;
  const add = (set: string) =>
    (poolSize += opts.avoidAmbiguous
      ? [...set].filter((c) => !AMBIGUOUS.has(c)).length
      : set.length);
  if (opts.lowercase) add(LOWER);
  if (opts.uppercase) add(UPPER);
  if (opts.numbers) add(DIGITS);
  if (opts.symbols) add(SYMBOLS);
  if (poolSize === 0) poolSize = 26;
  return opts.length * Math.log2(poolSize);
}

export async function generatePassphrase(opts: PassphraseOptions): Promise<string> {
  const { EFF_LARGE } = await import('./wordlist');
  const count = Math.max(3, opts.words);
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    let w = pick(EFF_LARGE);
    if (opts.capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
    words.push(w);
  }
  if (opts.includeNumber) {
    const at = randomInt(words.length);
    words[at] = words[at] + randomInt(10);
  }
  return words.join(opts.separator || '-');
}

/** Bits of entropy for a passphrase from the 7,776-word EFF list. */
export function passphraseEntropyBits(opts: PassphraseOptions): number {
  return opts.words * Math.log2(7776) + (opts.includeNumber ? Math.log2(10) : 0);
}

/** Format entropy bits into a short qualitative label. */
export function entropyLabel(bits: number): string {
  if (bits < 40) return 'Very weak';
  if (bits < 60) return 'Weak';
  if (bits < 80) return 'Reasonable';
  if (bits < 120) return 'Strong';
  return 'Overkill';
}
