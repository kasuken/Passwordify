import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getClientPrincipal, isAuthenticated } from '../lib/principal';
import { planConfig } from '../lib/plans';
import { getOrCreateUser, getUsage, isStoreConfigured } from '../lib/store';
import { isStripeConfigured } from '../lib/stripe';
import { refreshUserPlanNow } from '../lib/billing';
import { errorResponse, json, preflightResponse } from '../lib/respond';

/**
 * GET /api/me — returns the signed-in user's dashboard state: plan, this
 * month's usage, and their API key's public metadata (never the secret).
 * Creates a Free user record on first visit.
 */
export async function meHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const principal = getClientPrincipal(request);
  if (!isAuthenticated(principal)) {
    return errorResponse(401, 'unauthenticated', 'Sign in to access your account.');
  }

  if (!isStoreConfigured()) {
    return errorResponse(503, 'store_unconfigured', 'Account storage is not configured yet. Set PASSWORDIFY_STORAGE_CONNECTION.');
  }

  let user = await getOrCreateUser(principal.userId, principal.userDetails ?? '', principal.identityProvider ?? '');
  // The dashboard always shows a live view: verify the plan against Stripe now.
  user = await refreshUserPlanNow(user);
  const cfg = planConfig(user.plan);
  const usage = await getUsage(`user:${user.userId}`);

  return json(200, {
    authenticated: true,
    email: user.email,
    provider: user.provider,
    plan: user.plan,
    planLabel: cfg.label,
    quota: cfg.monthlyQuota,
    maxKeys: cfg.maxKeys,
    usage: { used: usage.used, limit: cfg.monthlyQuota, month: usage.month },
    subscriptionStatus: user.subscriptionStatus ?? null,
    hasBilling: !!user.stripeCustomerId,
    billingEnabled: isStripeConfigured(),
    key: user.keyHash
      ? { prefix: user.keyPrefix ?? '', last4: user.keyLast4 ?? '', createdAt: user.keyCreatedAt ?? '' }
      : null,
  });
}

app.http('me', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'me',
  handler: meHandler,
});
