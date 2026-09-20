import Stripe from 'stripe';

/**
 * Thin Stripe helper. All secrets and IDs come from application settings so
 * nothing sensitive is committed:
 *
 *   STRIPE_SECRET_KEY          sk_live_… / sk_test_…
 *   STRIPE_WEBHOOK_SECRET      whsec_…            (from the webhook endpoint)
 *   STRIPE_PRICE_PRO_MONTHLY   price_…            (Pro, $2 / month)
 *   STRIPE_PRICE_PRO_ANNUAL    price_…            (Pro, $18 / year = $1.50/mo)
 *   SITE_URL                   https://passwordify.xyz (for redirect URLs)
 */
let cached: Stripe | null = null;

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
  return (process.env.SITE_URL || 'https://passwordify.xyz').replace(/\/+$/, '');
}
