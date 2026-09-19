import { analyzeStrength } from './strength';
import { checkBreach } from './breach';

export interface Policy {
  minLength: number;
  maxLength: number;
  minScore: number;
  screenBreaches: boolean;
}

export const NIST_DEFAULT: Policy = {
  minLength: 8, // NIST SP 800-63B floor for user-chosen secrets
  maxLength: 64,
  minScore: 2,
  screenBreaches: true,
};

export interface ValidateResult {
  valid: boolean;
  score: number;
  breached: boolean;
  breachCount: number;
  violations: string[];
  feedback: { warning: string; suggestions: string[] };
}

/**
 * NIST SP 800-63B–aligned validation. Note what we deliberately DON'T do:
 * no forced composition rules (upper+digit+symbol) and no periodic expiry —
 * 800-63B advises against both. We check length and screen against breaches.
 */
export async function validatePassword(
  password: string,
  policy: Policy = NIST_DEFAULT,
  signal?: AbortSignal,
): Promise<ValidateResult> {
  const violations: string[] = [];
  if (!password) violations.push('empty');
  if (password.length < policy.minLength) violations.push('too_short');
  if (password.length > policy.maxLength) violations.push('too_long');

  const strength = await analyzeStrength(password);
  if (strength.score < policy.minScore) violations.push('weak');

  let breached = false;
  let breachCount = 0;
  if (policy.screenBreaches && password) {
    try {
      const b = await checkBreach(password, signal);
      breached = b.breached;
      breachCount = b.count;
      if (breached) violations.push('found_in_breach');
    } catch {
      // Breach service unavailable — do not fail closed on a network error.
    }
  }

  return {
    valid: violations.length === 0,
    score: strength.score,
    breached,
    breachCount,
    violations,
    feedback: strength.feedback,
  };
}
