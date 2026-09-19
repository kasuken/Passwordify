import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticate, rateLimitFor, rateLimitHeaders } from '../lib/auth';
import { errorResponse, json, preflightResponse } from '../lib/respond';
import { analyze } from '../lib/strength';

interface StrengthRequestBody {
  password?: unknown;
  userInputs?: unknown;
}

export async function strengthHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
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

  let body: StrengthRequestBody;
  try {
    body = ((await request.json()) ?? {}) as StrengthRequestBody;
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON.', rlHeaders);
  }

  if (typeof body.password !== 'string' || body.password.length === 0) {
    return errorResponse(400, 'missing_field', '"password" is required and must be a non-empty string.', rlHeaders);
  }

  let userInputs: string[] | undefined;
  if (body.userInputs !== undefined) {
    if (!Array.isArray(body.userInputs) || !body.userInputs.every((v) => typeof v === 'string')) {
      return errorResponse(400, 'invalid_field', '"userInputs" must be an array of strings if provided.', rlHeaders);
    }
    userInputs = body.userInputs;
  }

  const result = analyze(body.password, userInputs);

  return json(200, result, rlHeaders);
}

app.http('strength', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'v1/strength',
  handler: strengthHandler,
});
