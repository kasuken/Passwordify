import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticate, rateLimitFor, rateLimitHeaders } from '../lib/auth';
import { checkBreach } from '../lib/breach';
import { validatePolicy, type PolicyOptions } from '../lib/policy';
import { errorResponse, json, preflightResponse } from '../lib/respond';
import { analyze } from '../lib/strength';

interface ValidateRequestBody {
  password?: unknown;
  policy?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePolicyOptions(raw: unknown): PolicyOptions | { error: string } {
  if (raw === undefined) {
    return {};
  }
  if (!isPlainObject(raw)) {
    return { error: '"policy" must be an object if provided.' };
  }

  const options: PolicyOptions = {};
  const numericFields: (keyof PolicyOptions)[] = ['minLength', 'recommendedLength', 'maxLength'];
  for (const field of numericFields) {
    const value = raw[field];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return { error: `"policy.${field}" must be a non-negative number if provided.` };
    }
    (options as Record<string, number>)[field] = value;
  }

  if (raw.screenBreaches !== undefined) {
    if (typeof raw.screenBreaches !== 'boolean') {
      return { error: '"policy.screenBreaches" must be a boolean if provided.' };
    }
    options.screenBreaches = raw.screenBreaches;
  }

  return options;
}

export async function validateHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
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

  let body: ValidateRequestBody;
  try {
    body = ((await request.json()) ?? {}) as ValidateRequestBody;
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON.', rlHeaders);
  }

  if (typeof body.password !== 'string' || body.password.length === 0) {
    return errorResponse(400, 'missing_field', '"password" is required and must be a non-empty string.', rlHeaders);
  }

  const policyOptions = parsePolicyOptions(body.policy);
  if ('error' in policyOptions) {
    return errorResponse(400, 'invalid_field', policyOptions.error, rlHeaders);
  }

  const screenBreaches = policyOptions.screenBreaches ?? true;

  let breached = false;
  let breachCount = 0;
  if (screenBreaches) {
    try {
      const breachResult = await checkBreach(body.password);
      breached = breachResult.breached;
      breachCount = breachResult.count;
    } catch (err) {
      return errorResponse(
        502,
        'upstream_error',
        `Failed to reach the breach-checking service: ${err instanceof Error ? err.message : String(err)}`,
        rlHeaders
      );
    }
  }

  const strength = analyze(body.password);
  const policy = validatePolicy(body.password, breached, policyOptions);

  return json(
    200,
    {
      valid: policy.valid,
      score: strength.score,
      breached,
      breachCount,
      violations: policy.violations,
      feedback: strength.feedback,
      policy: {
        minLength: policy.minLength,
        recommendedLength: policy.recommendedLength,
        maxLength: policy.maxLength,
        screenBreaches: policy.screenBreaches,
      },
    },
    rlHeaders
  );
}

app.http('validate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'v1/validate',
  handler: validateHandler,
});
