/**
 * Plan definitions for Passwordify.
 *
 * Only two paid-facing tiers exist: Free and Pro. `demo` is an internal tier
 * for the public demo key (`pk_test_passwordify_demo`) and is not sold.
 *
 * Quotas are intentionally kept in one place so pricing copy on the site and
 * the enforcement here stay in sync. Adjust these numbers freely — they are the
 * single source of truth for what a key is allowed to do.
 */
export type PlanId = 'free' | 'pro' | 'demo';

export interface PlanConfig {
  id: PlanId;
  label: string;
  /** Hard cap of API requests per calendar month. */
  monthlyQuota: number;
  /** Maximum number of simultaneously-active API keys a user may hold. */
  maxKeys: number;
  /** Coarse burst limit (requests per rolling hour) to blunt abuse. */
  burstPerHour: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  demo: { id: 'demo', label: 'Demo', monthlyQuota: 1_000, maxKeys: 0, burstPerHour: 60 },
  free: { id: 'free', label: 'Free', monthlyQuota: 1_000, maxKeys: 1, burstPerHour: 600 },
  pro: { id: 'pro', label: 'Pro', monthlyQuota: 100_000, maxKeys: 5, burstPerHour: 6_000 },
};

export function planConfig(plan: PlanId): PlanConfig {
  return PLANS[plan] ?? PLANS.free;
}
