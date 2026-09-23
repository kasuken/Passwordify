import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getClientPrincipal, isAuthenticated } from '../lib/principal';
import { getOrCreateUser, isStoreConfigured, upsertUser } from '../lib/store';
import { getStripe, isStripeConfigured, priceIdFor, siteUrl, type BillingInterval } from '../lib/stripe';
import { errorResponse, json, preflightResponse } from '../lib/respond';

interface CheckoutBody {
  interval?: unknown;
}

// SWA exposes GitHub logins as a username (not an email), so `user.email` may
// hold something like "kasuken". Only pass a real email to Stripe; otherwise
// let Stripe Checkout collect it.
function asEmail(value: string | undefined): string | undefined {
  return value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : undefined;
}

/**
 * POST /api/checkout — start a Stripe Checkout session for the Pro plan.
 * Body: { interval: "monthly" | "annual" }. Returns { url } to redirect to.
 */
export async function checkoutHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const principal = getClientPrincipal(request);
  if (!isAuthenticated(principal)) {
    return errorResponse(401, 'unauthenticated', 'Sign in before upgrading.');
  }
  if (!isStoreConfigured()) {
    return errorResponse(503, 'store_unconfigured', 'Account storage is not configured yet.');
  }
  if (!isStripeConfigured()) {
    return errorResponse(503, 'billing_unconfigured', 'Billing is not configured yet.');
  }

  let body: CheckoutBody;
  try {
    body = ((await request.json()) ?? {}) as CheckoutBody;
  } catch {
    body = {};
  }
  const interval: BillingInterval = body.interval === 'annual' ? 'annual' : 'monthly';

  let priceId: string;
  try {
    priceId = priceIdFor(interval);
  } catch (err) {
    return errorResponse(503, 'price_unconfigured', err instanceof Error ? err.message : 'Price not configured.');
  }

  const stripe = getStripe();
  const user = await getOrCreateUser(principal.userId, principal.userDetails ?? '', principal.identityProvider ?? '');

  try {
    // Reuse or create the Stripe customer, keyed to our stable userId.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: asEmail(user.email),
        metadata: { userId: user.userId, provider: user.provider, login: user.email },
      });
      customerId = customer.id;
      await upsertUser({ ...user, stripeCustomerId: customerId, updatedAt: new Date().toISOString() });
    }

    const site = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.userId,
      subscription_data: { metadata: { userId: user.userId } },
      allow_promotion_codes: true,
      success_url: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/checkout/cancel`,
    });

    return json(200, { url: session.url });
  } catch (err) {
    // Surface the real Stripe reason (bad key scope, test/live mismatch,
    // missing price, etc.) instead of a generic failure.
    const message = err instanceof Error ? err.message : 'Stripe request failed.';
    context.error('Stripe checkout failed', err);
    return errorResponse(502, 'stripe_error', message);
  }
}

app.http('checkout', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'checkout',
  handler: checkoutHandler,
});
