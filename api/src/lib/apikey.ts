import { createHash, randomBytes } from 'node:crypto';

/**
 * Passwordify API keys look like `pk_live_<random>`. The random part is 24
 * bytes of CSPRNG output, base64url-encoded (~32 url-safe chars), giving 192
 * bits of entropy — far beyond guessable.
 *
 * We never store the raw key. Only its SHA-256 hash is persisted; the full key
 * is shown to the user exactly once, at creation time.
 */
export const KEY_PREFIX = 'pk_live_';

export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(24).toString('base64url');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Short, non-secret display prefix, e.g. `pk_live_9f2a…`. */
export function keyDisplayPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 4);
}

export function keyLast4(key: string): string {
  return key.slice(-4);
}
