import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { generateApiKey, hashApiKey, keyDisplayPrefix, keyLast4 } from '../lib/apikey';
import { getClientPrincipal, isAuthenticated } from '../lib/principal';
import { deactivateKey, getOrCreateUser, isStoreConfigured, putKey, upsertUser } from '../lib/store';
import { errorResponse, json, preflightResponse } from '../lib/respond';

/**
 * API key management for the signed-in user.
 *
 *   POST   /api/keys  → create or rotate the key (any existing key is revoked).
 *                       The full secret is returned exactly once.
 *   DELETE /api/keys  → revoke the current key.
 *
 * Only the SHA-256 hash of the key is ever stored.
 */
export async function keysHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const principal = getClientPrincipal(request);
  if (!isAuthenticated(principal)) {
    return errorResponse(401, 'unauthenticated', 'Sign in to manage API keys.');
  }
  if (!isStoreConfigured()) {
    return errorResponse(503, 'store_unconfigured', 'Account storage is not configured yet.');
  }

  const user = await getOrCreateUser(principal.userId, principal.userDetails ?? '', principal.identityProvider ?? '');
  const now = new Date().toISOString();

  if (request.method === 'DELETE') {
    if (user.keyHash) {
      await deactivateKey(user.keyHash);
      await upsertUser({ ...user, keyHash: undefined, keyPrefix: undefined, keyLast4: undefined, keyCreatedAt: undefined, updatedAt: now });
    }
    return json(200, { revoked: true });
  }

  // POST — create / rotate.
  if (user.keyHash) {
    await deactivateKey(user.keyHash);
  }

  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  const prefix = keyDisplayPrefix(key);
  const last4 = keyLast4(key);

  await putKey({ keyHash, userId: user.userId, plan: user.plan, active: true, prefix, last4, createdAt: now });
  await upsertUser({ ...user, keyHash, keyPrefix: prefix, keyLast4: last4, keyCreatedAt: now, updatedAt: now });

  return json(201, {
    key, // shown once — never retrievable again
    prefix,
    last4,
    createdAt: now,
    warning: 'Store this key securely. You will not be able to see it again.',
  });
}

app.http('keys', {
  methods: ['POST', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'keys',
  handler: keysHandler,
});
