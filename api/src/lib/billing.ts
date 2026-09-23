import type { PlanId } from './plans';
import { getUser, setKeyPlanChecked, upsertUser, type UserRecord } from './store';
import { getActiveSubscriptionPlan, isStripeConfigured } from './stripe';

/**
 * Plan entitlement is verified LIVE against Stripe (no webhook) and cached in the
 * store. The dashboard checks on every load; the API hot path re-checks at most
 * once per key per TTL window, so a normal request never calls Stripe.
 */
export const PLAN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Verify a user's plan against Stripe and persist the result (on the user and,
 * if present, their active key). Returns the updated user. Falls back to the
 * existing record if Stripe is unreachable, so a Stripe hiccup never locks a
 * paying customer out.
 */
export async function syncUserPlan(user: UserRecord): Promise<UserRecord> {
  if (!isStripeConfigured()) return user;
  const now = new Date().toISOString();

  // No Stripe customer means they have never paid — they are Free.
  if (!user.stripeCustomerId) {
    if (user.plan !== 'free' || !user.planCheckedAt) {
      const updated: UserRecord = { ...user, plan: 'free', planCheckedAt: now, updatedAt: now };
      await upsertUser(updated);
      if (updated.keyHash) await setKeyPlanChecked(updated.keyHash, 'free', now);
      return updated;
    }
    return user;
  }

  const { plan, status } = await getActiveSubscriptionPlan(user.stripeCustomerId);
  const updated: UserRecord = {
    ...user,
    plan,
    subscriptionStatus: status,
    planCheckedAt: now,
    updatedAt: now,
  };
  await upsertUser(updated);
  if (updated.keyHash) await setKeyPlanChecked(updated.keyHash, plan, now);
  return updated;
}

/** Force a live refresh (used by the dashboard). Never throws. */
export async function refreshUserPlanNow(user: UserRecord): Promise<UserRecord> {
  try {
    return await syncUserPlan(user);
  } catch {
    return user;
  }
}

/**
 * Hot-path entitlement for an API key. Returns the cached plan if it was
 * verified within the TTL; otherwise re-verifies against Stripe once, updates
 * the cache, and returns the fresh plan. Never throws — on any error it keeps
 * the last-known plan (fail-open).
 */
export async function planForKey(
  userId: string,
  keyHash: string,
  cachedPlan: PlanId,
  planCheckedAt: string | undefined
): Promise<PlanId> {
  const fresh = planCheckedAt && Date.now() - Date.parse(planCheckedAt) < PLAN_TTL_MS;
  if (fresh) return cachedPlan;

  const now = new Date().toISOString();
  try {
    // If Stripe isn't configured we can't verify — stamp so we don't retry every
    // request, and keep the cached plan.
    if (!isStripeConfigured()) {
      await setKeyPlanChecked(keyHash, cachedPlan, now);
      return cachedPlan;
    }
    const user = await getUser(userId);
    if (!user) return cachedPlan;
    const updated = await syncUserPlan(user);
    return updated.plan;
  } catch {
    return cachedPlan;
  }
}
