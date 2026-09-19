import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticate, rateLimitFor, rateLimitHeaders } from '../lib/auth';
import { checkBreach, checkBreachByPrefix } from '../lib/breach';
import { errorResponse, json, preflightResponse } from '../lib/respond';

interface BreachRequestBody {
  password?: unknown;
  sha1Prefix?: unknown;
  sha1Suffix?: unknown;
}

const HEX_PREFIX_RE = /^[0-9a-fA-F]{5}$/;
const HEX_SUFFIX_RE = /^[0-9a-fA-F]{35}$/;

export async function breachHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const auth = authenticate(request);
  if (!auth.ok) {
    return errorResponse(auth.status, auth.code, auth.message);
  }

  const rl = rateLimitFor(auth.keyId);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.ok) {
    return errorResponse(429, 'rate_limited', 'Rate limit exceeded. Please slow down and try again later.', rlHeaders);
  }

  let body: BreachRequestBody;
  try {
    body = ((await request.json()) ?? {}) as BreachRequestBody;
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON.', rlHeaders);
  }

  const hasPassword = typeof body.password === 'string' && body.password.length > 0;
  const hasPrefixSuffix = typeof body.sha1Prefix === 'string' && typeof body.sha1Suffix === 'string';

  if (!hasPassword && !hasPrefixSuffix) {
    return errorResponse(
      400,
      'missing_field',
      'Provide either "password" (string) or both "sha1Prefix" (5 hex chars) and "sha1Suffix" (35 hex chars).',
      rlHeaders
    );
  }

  try {
    if (hasPassword) {
      const result = await checkBreach(body.password as string);
      return json(200, result, rlHeaders);
    }

    const prefix = body.sha1Prefix as string;
    const suffix = body.sha1Suffix as string;

    if (!HEX_PREFIX_RE.test(prefix) || !HEX_SUFFIX_RE.test(suffix)) {
      return errorResponse(
        400,
        'invalid_field',
        '"sha1Prefix" must be 5 hex characters and "sha1Suffix" must be 35 hex characters.',
        rlHeaders
      );
    }

    const result = await checkBreachByPrefix(prefix, suffix);
    return json(200, result, rlHeaders);
  } catch (err) {
    return errorResponse(
      502,
      'upstream_error',
      `Failed to reach the breach-checking service: ${err instanceof Error ? err.message : String(err)}`,
      rlHeaders
    );
  }
}

app.http('breach', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'v1/breach',
  handler: breachHandler,
});
