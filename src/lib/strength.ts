import { ZxcvbnFactory } from '@zxcvbn-ts/core';

export interface StrengthResult {
  /** zxcvbn score, 0 (worst) … 4 (best). */
  score: 0 | 1 | 2 | 3 | 4;
  /** Estimated number of guesses to crack. */
  guesses: number;
  /** Shannon-style entropy estimate derived from guesses (bits). */
  entropyBits: number;
  /** Human-readable crack time at 10 B guesses/sec (offline, fast hash). */
  crackTimeOfflineFast: string;
  /** Human-readable crack time at 10 guesses/sec (online, throttled). */
  crackTimeOnline: string;
  feedback: {
    warning: string;
    suggestions: string[];
  };
}

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;
export function scoreLabel(score: number): string {
  return LABELS[Math.max(0, Math.min(4, score))];
}

let factoryPromise: Promise<InstanceType<typeof ZxcvbnFactory>> | null = null;

/**
 * Lazily construct the zxcvbn factory with dictionaries + adjacency graphs.
 * They are a few tens of KB, so we keep them out of the initial bundle and
 * load them on first use.
 */
async function getFactory() {
  if (factoryPromise) return factoryPromise;
  factoryPromise = (async () => {
    const [common, en] = await Promise.all([
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ]);
    return new ZxcvbnFactory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: {
        ...common.dictionary,
        ...en.dictionary,
      },
    });
  })();
  return factoryPromise;
}

/**
 * Analyze a password's resistance to guessing. Runs entirely in the browser —
 * nothing is transmitted.
 */
export async function analyzeStrength(
  password: string,
  userInputs: string[] = [],
): Promise<StrengthResult> {
  const factory = await getFactory();
  const r = factory.check(password, userInputs);
  const guesses = Math.max(1, r.guesses);
  return {
    score: r.score as StrengthResult['score'],
    guesses,
    entropyBits: Math.log2(guesses),
    crackTimeOfflineFast: String(
      r.crackTimes.offlineFastHashingXPerSecond.display,
    ),
    crackTimeOnline: String(r.crackTimes.onlineNoThrottlingXPerSecond.display),
    feedback: {
      warning: r.feedback.warning ?? '',
      suggestions: r.feedback.suggestions ?? [],
    },
  };
}
