/**
 * SHA-1 helper backed by the Web Crypto API.
 *
 * SHA-1 is used here ONLY to talk to Have I Been Pwned's k-anonymity range
 * API (their corpus is indexed by SHA-1). It is never used to protect a
 * password — that would be inappropriate for a modern system.
 */
export async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
