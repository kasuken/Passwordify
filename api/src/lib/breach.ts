import { createHash } from 'node:crypto';

const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export interface BreachResult {
  breached: boolean;
  count: number;
}

function sha1Hex(value: string): string {
  return createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
}

/**
 * Query the "Have I Been Pwned" Pwned Passwords range endpoint for a given
 * 5-character SHA-1 prefix, and look for `suffixToMatch` (the remaining
 * 35 hex characters) among the results.
 *
 * `Add-Padding: true` asks the API to pad the response with decoy entries
 * (per the k-anonymity spec), which we simply ignore since we match on the
 * exact suffix.
 */
export async function checkBreachByPrefix(prefix: string, suffixToMatch: string): Promise<BreachResult> {
  const normalizedPrefix = prefix.trim().toUpperCase();
  const normalizedSuffix = suffixToMatch.trim().toUpperCase();

  const response = await fetch(`${PWNED_RANGE_URL}${normalizedPrefix}`, {
    method: 'GET',
    headers: {
      'Add-Padding': 'true',
      'User-Agent': 'Passwordify-API',
    },
  });

  if (!response.ok) {
    throw new Error(`Pwned Passwords API returned HTTP ${response.status}`);
  }

  const body = await response.text();
  const lines = body.split('\n');

  for (const line of lines) {
    const [suffix, countRaw] = line.trim().split(':');
    if (suffix && suffix.toUpperCase() === normalizedSuffix) {
      const count = Number.parseInt(countRaw ?? '0', 10);
      return { breached: count > 0, count: Number.isFinite(count) ? count : 0 };
    }
  }

  return { breached: false, count: 0 };
}

/**
 * Check whether a plaintext password appears in the Have I Been Pwned
 * Pwned Passwords breach corpus, using k-anonymity: only the first 5
 * characters of the SHA-1 hash are ever sent over the network.
 */
export async function checkBreach(password: string): Promise<BreachResult> {
  const hash = sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  return checkBreachByPrefix(prefix, suffix);
}
