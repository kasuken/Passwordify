import { randomInt } from 'node:crypto';
import { EFF_LARGE } from './wordlist';

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 128;
export const DEFAULT_LENGTH = 20;

export interface GeneratePasswordOptions {
  length?: number;
  lowercase?: boolean;
  uppercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
  avoidAmbiguous?: boolean;
}

interface ResolvedPasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export class PasswordGenerationError extends Error {}

// Visually-confusable characters (lowercase L, uppercase I, one, uppercase O,
// zero, lowercase o) that "avoidAmbiguous" strips from the letter/digit pools.
const AMBIGUOUS_CHARS = new Set(['l', 'I', '1', 'O', '0', 'o']);

const POOLS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}?',
} as const;

export function clampLength(length: number): number {
  if (!Number.isFinite(length)) {
    return DEFAULT_LENGTH;
  }
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(length)));
}

function resolvePasswordOptions(opts: GeneratePasswordOptions = {}): ResolvedPasswordOptions {
  return {
    length: clampLength(opts.length ?? DEFAULT_LENGTH),
    lowercase: opts.lowercase ?? true,
    uppercase: opts.uppercase ?? true,
    numbers: opts.numbers ?? true,
    symbols: opts.symbols ?? true,
    avoidAmbiguous: opts.avoidAmbiguous ?? false,
  };
}

function filterAmbiguous(chars: string): string {
  return chars
    .split('')
    .filter((char) => !AMBIGUOUS_CHARS.has(char))
    .join('');
}

function buildPools(options: ResolvedPasswordOptions): string[] {
  const maybeFilter = (chars: string): string => (options.avoidAmbiguous ? filterAmbiguous(chars) : chars);

  const pools: string[] = [];
  if (options.lowercase) pools.push(maybeFilter(POOLS.lowercase));
  if (options.uppercase) pools.push(maybeFilter(POOLS.uppercase));
  if (options.numbers) pools.push(maybeFilter(POOLS.numbers));
  if (options.symbols) pools.push(maybeFilter(POOLS.symbols));

  return pools.filter((pool) => pool.length > 0);
}

/** Pick a single unbiased random character from `pool` using a CSPRNG. */
function pickRandomChar(pool: string): string {
  return pool[randomInt(0, pool.length)];
}

/** Unbiased Fisher-Yates shuffle using a CSPRNG. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a cryptographically-random password using `crypto.randomInt`
 * (CSPRNG, unbiased). Guarantees at least one character from each enabled
 * character set, then fills the rest and shuffles.
 */
export function generatePassword(opts: GeneratePasswordOptions = {}): string {
  const options = resolvePasswordOptions(opts);
  const pools = buildPools(options);

  if (pools.length === 0) {
    throw new PasswordGenerationError(
      'At least one character set (lowercase, uppercase, numbers, symbols) must be enabled.'
    );
  }

  if (options.length < pools.length) {
    throw new PasswordGenerationError(
      `length (${options.length}) must be at least ${pools.length} to include one character from each enabled character set.`
    );
  }

  const combinedPool = pools.join('');
  const chars: string[] = pools.map((pool) => pickRandomChar(pool));

  while (chars.length < options.length) {
    chars.push(pickRandomChar(combinedPool));
  }

  return shuffle(chars).join('');
}

/**
 * Theoretical entropy (in bits) of a password generated with the given
 * options, i.e. length * log2(poolSize). This assumes a uniformly random
 * selection from the pool, which is what `generatePassword` provides
 * (modulo the "at least one from each pool" guarantee, which only ever
 * increases real-world unpredictability resistance, never decreases it).
 */
export function passwordEntropyBits(opts: GeneratePasswordOptions = {}): number {
  const options = resolvePasswordOptions(opts);
  const poolSize = buildPools(options).join('').length;

  if (poolSize === 0) {
    return 0;
  }

  return options.length * Math.log2(poolSize);
}

/* ---------------------------------------------------------------- *
 * Passphrase generation (EFF large diceware list, 7,776 words)
 * ---------------------------------------------------------------- */

export const MIN_WORDS = 3;
export const MAX_WORDS = 12;
export const DEFAULT_WORDS = 5;

export interface GeneratePassphraseOptions {
  words?: number;
  separator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
}

interface ResolvedPassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

function resolvePassphraseOptions(opts: GeneratePassphraseOptions = {}): ResolvedPassphraseOptions {
  const words = Number.isFinite(opts.words)
    ? Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(opts.words as number)))
    : DEFAULT_WORDS;
  return {
    words,
    separator: typeof opts.separator === 'string' ? opts.separator : '-',
    capitalize: opts.capitalize ?? true,
    includeNumber: opts.includeNumber ?? true,
  };
}

/** Generate a diceware-style passphrase from the EFF large wordlist (CSPRNG). */
export function generatePassphrase(opts: GeneratePassphraseOptions = {}): string {
  const options = resolvePassphraseOptions(opts);
  const words: string[] = [];
  for (let i = 0; i < options.words; i += 1) {
    let word = EFF_LARGE[randomInt(0, EFF_LARGE.length)];
    if (options.capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }
  if (options.includeNumber) {
    const at = randomInt(0, words.length);
    words[at] = words[at] + randomInt(0, 10);
  }
  return words.join(options.separator);
}

/** Theoretical entropy (bits) of a passphrase from the 7,776-word EFF list. */
export function passphraseEntropyBits(opts: GeneratePassphraseOptions = {}): number {
  const options = resolvePassphraseOptions(opts);
  return options.words * Math.log2(EFF_LARGE.length) + (options.includeNumber ? Math.log2(10) : 0);
}
