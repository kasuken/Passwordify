export interface PolicyOptions {
  minLength?: number;
  recommendedLength?: number;
  maxLength?: number;
  screenBreaches?: boolean;
}

export interface PolicyResult {
  valid: boolean;
  violations: string[];
  minLength: number;
  recommendedLength: number;
  maxLength: number;
  screenBreaches: boolean;
}

const DEFAULT_MIN_LENGTH = 8;
const DEFAULT_RECOMMENDED_LENGTH = 15;
const DEFAULT_MAX_LENGTH = 64;

/**
 * Validate a password against NIST SP 800-63B ("Digital Identity
 * Guidelines - Authentication and Lifecycle Management") style rules.
 *
 * IMPORTANT: NIST SP 800-63B section 5.1.1.2 explicitly recommends AGAINST
 * arbitrary composition rules (e.g. "must contain uppercase, lowercase, a
 * digit, and a symbol") and AGAINST mandatory periodic password expiration,
 * since both tend to push users toward predictable, weaker passwords. This
 * validator deliberately does NOT implement either of those. Instead, per
 * the guidance, it checks length and screens against known-breached /
 * commonly-used password lists.
 */
export function validatePolicy(
  password: string,
  breached: boolean,
  options: PolicyOptions = {}
): PolicyResult {
  const minLength = options.minLength ?? DEFAULT_MIN_LENGTH;
  const recommendedLength = options.recommendedLength ?? DEFAULT_RECOMMENDED_LENGTH;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const screenBreaches = options.screenBreaches ?? true;

  const violations: string[] = [];

  if (!password || password.length === 0) {
    violations.push('empty');
  } else {
    if (password.length < minLength) {
      violations.push('too_short');
    }
    if (password.length > maxLength) {
      violations.push('too_long');
    }
  }

  if (screenBreaches && breached) {
    violations.push('found_in_breach');
  }

  return {
    valid: violations.length === 0,
    violations,
    minLength,
    recommendedLength,
    maxLength,
    screenBreaches,
  };
}
