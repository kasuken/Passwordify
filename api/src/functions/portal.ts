import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getClientPrincipal, isAuthenticated } from '../lib/principal';
import { getUser, isStoreConfigured } from '../lib/store';
import { getStripe, isStripeConfigured, siteUrl } from '../lib/stripe';
import { errorResponse, json, preflightResponse } from '../lib/respond';

/**
 * POST /api/portal — open the Stripe Billing Portal so a customer can update
 * their payment method, switch billing interval, or cancel. Returns { url }.
 */
export async function portalHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const principal = getClientPrincipal(request);
  if (!isAuthenticated(principal)) {
    return errorResponse(401, 'unauthenticated', 'Sign in to manage billing.');
  }
  if (!isStoreConfigured()) {
    return errorResponse(503, 'store_unconfigured', 'Account storage is not configured yet.');
  }
  if (!isStripeConfigured()) {
    return errorResponse(503, 'billing_unconfigured', 'Billing is not configured yet.');
  }

  const user = await getUser(principal.userId);
  if (!user?.stripeCustomerId) {
    return errorResponse(400, 'no_customer', 'No billing account found. Upgrade to Pro first.');
  }

  const stripe = getStripe();
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${siteUrl()}/dashboard`,
    });
    return json(200, { url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe request failed.';
    context.error('Stripe billing portal failed', err);
    return errorResponse(502, 'stripe_error', message);
  }
}

app.http('portal', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portal',
  handler: portalHandler,
});
