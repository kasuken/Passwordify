import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type Stripe from 'stripe';
import { getStripe } from '../lib/stripe';
import { getUser, getUserByCustomerId, setKeyPlan, upsertUser, type UserRecord } from '../lib/store';
import type { PlanId } from '../lib/plans';

/**
 * POST /api/stripe/webhook — receives Stripe events and keeps each user's plan
 * in sync with their subscription. The signature is verified against
 * STRIPE_WEBHOOK_SECRET using the RAW request body, so this handler must read
 * the body as text (never parsed JSON) before verifying.
 *
 * This endpoint is called by Stripe, not the browser — it is intentionally
 * unauthenticated (its authenticity comes from the signature check).
 */
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function planForStatus(status: string): PlanId {
  return ACTIVE_STATUSES.has(status) ? 'pro' : 'free';
}

async function applyPlan(user: UserRecord, plan: PlanId, patch: Partial<UserRecord>): Promise<void> {
  await upsertUser({ ...user, ...patch, plan, updatedAt: new Date().toISOString() });
  if (user.keyHash) {
    await setKeyPlan(user.keyHash, plan);
  }
}

async function resolveUser(userId: string | null | undefined, customerId: string | null | undefined): Promise<UserRecord | null> {
  if (userId) {
    const u = await getUser(userId);
    if (u) return u;
  }
  if (customerId) {
    return getUserByCustomerId(customerId);
  }
  return null;
}

export async function stripeWebhookHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return { status: 400, body: 'Missing signature or webhook secret.' };
  }

  const raw = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    context.error('Stripe signature verification failed', err);
    return { status: 400, body: `Webhook signature verification failed.` };
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? (session.metadata?.userId as string | undefined);
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const user = await resolveUser(userId, customerId);
        if (user) {
          await applyPlan(user, 'pro', {
            stripeCustomerId: customerId ?? user.stripeCustomerId,
            stripeSubscriptionId: subscriptionId ?? user.stripeSubscriptionId,
            subscriptionStatus: 'active',
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId as string | undefined;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const user = await resolveUser(userId, customerId);
        if (user) {
          await applyPlan(user, planForStatus(sub.status), {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status,
            stripeCustomerId: customerId ?? user.stripeCustomerId,
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId as string | undefined;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const user = await resolveUser(userId, customerId);
        if (user) {
          await applyPlan(user, 'free', { subscriptionStatus: 'canceled' });
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    context.error(`Failed to process Stripe event ${event.type}`, err);
    return { status: 500, body: 'Failed to process event.' };
  }

  return { status: 200, body: 'ok' };
}

app.http('stripe-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'stripe/webhook',
  handler: stripeWebhookHandler,
});
