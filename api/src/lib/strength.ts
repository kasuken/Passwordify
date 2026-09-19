import { ZxcvbnFactory, type ZxcvbnResult } from '@zxcvbn-ts/core';
import { dictionary as commonDictionary, adjacencyGraphs } from '@zxcvbn-ts/language-common';
import { dictionary as enDictionary, translations as enTranslations } from '@zxcvbn-ts/language-en';

// The factory does non-trivial setup (ranking dictionaries, etc.) so we build
// it exactly once at module load and reuse it for every invocation/request.
const zxcvbnFactory = new ZxcvbnFactory({
  translations: enTranslations,
  graphs: adjacencyGraphs,
  dictionary: {
    ...commonDictionary,
    ...enDictionary,
  },
});

export interface CrackTimeSummary {
  seconds: number;
  display: string;
}

export interface StrengthAnalysis {
  score: 0 | 1 | 2 | 3 | 4;
  guesses: number;
  entropyBits: number;
  crackTimeOfflineFast: CrackTimeSummary;
  crackTimeOnline: CrackTimeSummary;
  feedback: {
    warning: string | null;
    suggestions: string[];
  };
}

function toCrackTimeSummary(crackTime: ZxcvbnResult['crackTimes'][keyof ZxcvbnResult['crackTimes']]): CrackTimeSummary {
  return {
    seconds: crackTime.seconds,
    display: crackTime.display,
  };
}

/**
 * Analyze a password's strength using zxcvbn-ts.
 *
 * @param password The password to analyze.
 * @param userInputs Optional contextual strings (e.g. username, email, site name)
 *                    that should be penalized if reused inside the password.
 */
export function analyze(password: string, userInputs?: string[]): StrengthAnalysis {
  const result: ZxcvbnResult = zxcvbnFactory.check(password, userInputs);

  return {
    score: result.score,
    guesses: result.guesses,
    entropyBits: Math.log2(result.guesses),
    // Offline, fast-hash attack (e.g. a leaked hash cracked with GPUs) -
    // the worst-case, most pessimistic estimate.
    crackTimeOfflineFast: toCrackTimeSummary(result.crackTimes.offlineFastHashingXPerSecond),
    // Online attack against a throttled service (e.g. a login form with
    // basic rate limiting) - the more realistic estimate for most apps.
    crackTimeOnline: toCrackTimeSummary(result.crackTimes.onlineThrottlingXPerHour),
    feedback: {
      warning: result.feedback.warning || null,
      suggestions: result.feedback.suggestions ?? [],
    },
  };
}
