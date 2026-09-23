import Stripe from 'stripe';
import type { PlanId } from './plans';

/**
 * Thin Stripe helper. All secrets and IDs come from application settings so
 * nothing sensitive is committed:
 *
 *   STRIPE_SECRET_KEY          sk_live_… / sk_test_…
 *   STRIPE_PRICE_PRO_MONTHLY   price_…            (Pro, $2 / month)
 *   STRIPE_PRICE_PRO_ANNUAL    price_…            (Pro, $18 / year = $1.50/mo)
 *   SITE_URL                   https://www.passwordify.xyz (for redirect URLs)
 *
 * There is intentionally no webhook: a user's plan is verified live against
 * Stripe (and cached — see lib/billing.ts) rather than pushed by Stripe events.
 */
let cached: Stripe | null = null;

/** Subscription statuses that grant Pro access (active + grace states). */
const ENTITLED_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  if (!cached) {
    cached = new Stripe(secret);
  }
  return cached;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export type BillingInterval = 'monthly' | 'annual';

export function priceIdFor(interval: BillingInterval): string {
  const id = interval === 'annual' ? process.env.STRIPE_PRICE_PRO_ANNUAL : process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id) {
    throw new Error(`No Stripe price configured for the "${interval}" interval.`);
  }
  return id;
}

export function siteUrl(): string {
  return (process.env.SITE_URL || 'https://www.passwordify.xyz').replace(/\/+$/, '');
}

/**
 * Live-check a customer's entitlement against Stripe. Returns 'pro' if they have
 * any active/trialing/past-due subscription, otherwise 'free', plus the most
 * relevant subscription status for display.
 */
export async function getActiveSubscriptionPlan(customerId: string): Promise<{ plan: PlanId; status?: string }> {
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const entitled = subs.data.find((s) => ENTITLED_STATUSES.has(s.status));
  if (entitled) {
    return { plan: 'pro', status: entitled.status };
  }
  return { plan: 'free', status: subs.data[0]?.status };
}
