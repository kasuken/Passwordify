import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../lib/auth';
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

  const authz = await authorize(request);
  if (!authz.ok) {
    return errorResponse(authz.status, authz.code, authz.message, authz.headers);
  }
  const rlHeaders = authz.headers;

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
