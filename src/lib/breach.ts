import { sha1Hex } from './sha1';

export interface BreachResult {
  /** true when the exact password appears in a known breach corpus. */
  breached: boolean;
  /** Number of times the password has been seen across breaches. */
  count: number;
}

/**
 * Check a password against Have I Been Pwned's Pwned Passwords corpus using
 * k-anonymity: we hash the password with SHA-1 locally and send ONLY the first
 * five hex characters of that hash. HIBP returns every suffix that shares the
 * prefix (hundreds of candidates), and we match the remainder in the browser.
 *
 * The full password — and even its full hash — never leaves the device.
 * `Add-Padding` asks HIBP to pad the response so its size can't hint at the
 * result.
 */
export async function checkBreach(
  password: string,
  signal?: AbortSignal,
): Promise<BreachResult> {
  if (!password) return { breached: false, count: 0 };

  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Pwned Passwords request failed (${res.status})`);
  }

  const body = await res.text();
  for (const line of body.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const suf = line.slice(0, idx).trim().toUpperCase();
    if (suf === suffix) {
      const count = parseInt(line.slice(idx + 1).trim(), 10) || 0;
      return { breached: count > 0, count };
    }
  }
  return { breached: false, count: 0 };
}
