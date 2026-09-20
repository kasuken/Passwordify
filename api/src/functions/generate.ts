import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorize } from '../lib/auth';
import {
  clampLength,
  DEFAULT_LENGTH,
  generatePassword,
  passwordEntropyBits,
  generatePassphrase,
  passphraseEntropyBits,
  PasswordGenerationError,
  type GeneratePasswordOptions,
  type GeneratePassphraseOptions,
} from '../lib/generate';
import { errorResponse, json, preflightResponse } from '../lib/respond';

interface GenerateRequestBody {
  length?: unknown;
  count?: unknown;
  lowercase?: unknown;
  uppercase?: unknown;
  numbers?: unknown;
  symbols?: unknown;
  avoidAmbiguous?: unknown;
  mode?: unknown;
  words?: unknown;
  separator?: unknown;
  capitalize?: unknown;
  includeNumber?: unknown;
}

const MIN_COUNT = 1;
const MAX_COUNT = 100;
const DEFAULT_COUNT = 1;

function optionalBoolean(value: unknown, field: string): { ok: true; value?: boolean } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };
  if (typeof value !== 'boolean') return { ok: false, error: `"${field}" must be a boolean if provided.` };
  return { ok: true, value };
}

export async function generateHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const authz = await authorize(request);
  if (!authz.ok) {
    return errorResponse(authz.status, authz.code, authz.message, authz.headers);
  }
  const rlHeaders = authz.headers;

  let body: GenerateRequestBody;
  try {
    body = ((await request.json()) ?? {}) as GenerateRequestBody;
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON.', rlHeaders);
  }

  const mode = body.mode === undefined ? 'password' : body.mode;
  if (mode !== 'password' && mode !== 'passphrase') {
    return errorResponse(400, 'invalid_field', '"mode" must be "password" or "passphrase" if provided.', rlHeaders);
  }

  const count = Math.min(
    MAX_COUNT,
    Math.max(MIN_COUNT, Math.round(typeof body.count === 'number' ? body.count : DEFAULT_COUNT))
  );

  // ---- Passphrase mode (EFF large diceware wordlist) ----
  if (mode === 'passphrase') {
    if (body.words !== undefined && (typeof body.words !== 'number' || !Number.isFinite(body.words))) {
      return errorResponse(400, 'invalid_field', '"words" must be a number if provided.', rlHeaders);
    }
    if (body.separator !== undefined && typeof body.separator !== 'string') {
      return errorResponse(400, 'invalid_field', '"separator" must be a string if provided.', rlHeaders);
    }
    for (const field of ['capitalize', 'includeNumber'] as const) {
      const parsed = optionalBoolean(body[field], field);
      if (!parsed.ok) {
        return errorResponse(400, 'invalid_field', parsed.error, rlHeaders);
      }
    }
    const ppOptions: GeneratePassphraseOptions = {
      words: typeof body.words === 'number' ? body.words : undefined,
      separator: typeof body.separator === 'string' ? body.separator : undefined,
      capitalize: typeof body.capitalize === 'boolean' ? body.capitalize : undefined,
      includeNumber: typeof body.includeNumber === 'boolean' ? body.includeNumber : undefined,
    };
    const passwords = Array.from({ length: count }, () => generatePassphrase(ppOptions));
    const entropyBits = passphraseEntropyBits(ppOptions);
    return json(200, { passwords, entropyBits }, rlHeaders);
  }

  if (body.length !== undefined && (typeof body.length !== 'number' || !Number.isFinite(body.length))) {
    return errorResponse(400, 'invalid_field', '"length" must be a number if provided.', rlHeaders);
  }
  if (body.count !== undefined && (typeof body.count !== 'number' || !Number.isFinite(body.count))) {
    return errorResponse(400, 'invalid_field', '"count" must be a number if provided.', rlHeaders);
  }

  const boolFields: (keyof GenerateRequestBody)[] = ['lowercase', 'uppercase', 'numbers', 'symbols', 'avoidAmbiguous'];
  const boolValues: Partial<Record<string, boolean>> = {};
  for (const field of boolFields) {
    const parsed = optionalBoolean(body[field], field);
    if (!parsed.ok) {
      return errorResponse(400, 'invalid_field', parsed.error, rlHeaders);
    }
    if (parsed.value !== undefined) {
      boolValues[field] = parsed.value;
    }
  }

  const length = clampLength(typeof body.length === 'number' ? body.length : DEFAULT_LENGTH);

  const genOptions: GeneratePasswordOptions = {
    length,
    lowercase: boolValues.lowercase,
    uppercase: boolValues.uppercase,
    numbers: boolValues.numbers,
    symbols: boolValues.symbols,
    avoidAmbiguous: boolValues.avoidAmbiguous,
  };

  try {
    const passwords = Array.from({ length: count }, () => generatePassword(genOptions));
    const entropyBits = passwordEntropyBits(genOptions);

    return json(200, { passwords, entropyBits }, rlHeaders);
  } catch (err) {
    if (err instanceof PasswordGenerationError) {
      return errorResponse(400, 'invalid_options', err.message, rlHeaders);
    }
    throw err;
  }
}

app.http('generate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'v1/generate',
  handler: generateHandler,
});
