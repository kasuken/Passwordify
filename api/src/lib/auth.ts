import type { HttpRequest } from '@azure/functions';
import { hashApiKey } from './apikey';
import { PLANS, planConfig, type PlanId } from './plans';
import { getKeyByHash, incrementUsage, isStoreConfigured } from './store';

export interface AuthSuccess {
  ok: true;
  keyId: string;
}

export interface AuthFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Always-valid demo key so people can try the API without provisioning one.
 * It is intentionally rate-limited harder than "real" keys (see rateLimitFor).
 */
export const DEMO_API_KEY = 'pk_test_passwordify_demo';
export const DEMO_KEY_LIMIT = 60;
export const DEMO_KEY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const DEFAULT_KEY_LIMIT = 600;
export const DEFAULT_KEY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getConfiguredKeys(): Set<string> {
  const raw = process.env.PASSWORDIFY_API_KEYS ?? '';
  return new Set(
    raw
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0)
  );
}

/**
 * Authenticate an incoming request via `Authorization: Bearer <api-key>`.
 * Accepts the fixed demo key, or any key listed (comma-separated) in the
 * `PASSWORDIFY_API_KEYS` environment variable.
 */
export function authenticate(request: HttpRequest): AuthResult {
  const header = request.headers.get('authorization');

  if (!header || header.trim().length === 0) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Missing Authorization header. Provide "Authorization: Bearer <api-key>".',
    };
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const key = match?.[1]?.trim();

  if (!key) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Authorization header must be in the form "Bearer <api-key>".',
    };
  }

  if (key === DEMO_API_KEY) {
    return { ok: true, keyId: DEMO_API_KEY };
  }

  if (getConfiguredKeys().has(key)) {
    return { ok: true, keyId: key };
  }

  return {
    ok: false,
    status: 401,
    code: 'unauthorized',
    message: 'Invalid API key.',
  };
}

// --- In-memory fixed-window rate limiter -----------------------------
//
// NOTE: This is intentionally simple ("conceptual" rate limiting). It is
// per-process/per-instance state, so on Azure Functions Consumption plan
// (where multiple instances can be spun up, and instances are recycled)
// it does not provide a globally-accurate or durable limit. For a
// production-grade limiter, back this with a shared store such as Azure
// Table Storage, Redis, or API Management policies instead.

interface FixedWindow {
  count: number;
  windowStart: number;
}

const windows = new Map<string, FixedWindow>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export function rateLimit(keyId: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(keyId);

  if (!existing || now - existing.windowStart >= windowMs) {
    windows.set(keyId, { count: 1, windowStart: now });
    return { ok: true, limit, remaining: Math.max(0, limit - 1), resetMs: windowMs };
  }

  existing.count += 1;
  const resetMs = Math.max(0, windowMs - (now - existing.windowStart));

  if (existing.count > limit) {
    return { ok: false, limit, remaining: 0, resetMs };
  }

  return { ok: true, limit, remaining: Math.max(0, limit - existing.count), resetMs };
}

/**
 * Convenience wrapper applying the demo key's tighter limit, or the
 * default (higher) limit for any other configured key.
 */
export function rateLimitFor(keyId: string): RateLimitResult {
  if (keyId === DEMO_API_KEY) {
    return rateLimit(keyId, DEMO_KEY_LIMIT, DEMO_KEY_WINDOW_MS);
  }
  return rateLimit(keyId, DEFAULT_KEY_LIMIT, DEFAULT_KEY_WINDOW_MS);
}

/** Standard `X-RateLimit-*` response headers for a given rate limit check. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  };
}

// --- Plan-aware authorization (auth + burst limit + monthly quota) ---------
//
// `authorize()` is the single entry point every /v1 endpoint uses. It:
//   1. resolves the bearer token to a plan (demo key, env key, or a real key
//      provisioned via the dashboard and stored in Table Storage),
//   2. applies a coarse per-hour burst limit for that plan,
//   3. increments and enforces the plan's monthly quota (when a store is
//      configured), emitting X-RateLimit-* and X-Quota-* headers.

const HOUR_MS = 60 * 60 * 1000;

export interface AuthzSuccess {
  ok: true;
  keyId: string;
  plan: PlanId;
  headers: Record<string, string>;
}

export interface AuthzFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  headers: Record<string, string>;
}

export type AuthzResult = AuthzSuccess | AuthzFailure;

function extractBearer(request: HttpRequest): string | AuthFailure {
  const header = request.headers.get('authorization');
  if (!header || header.trim().length === 0) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Missing Authorization header. Provide "Authorization: Bearer <api-key>".',
    };
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const key = match?.[1]?.trim();
  if (!key) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Authorization header must be in the form "Bearer <api-key>".',
    };
  }
  return key;
}

interface ResolvedKey {
  keyId: string;
  plan: PlanId;
  /** Partition used for monthly usage accounting. */
  usagePartition: string;
}

async function resolveKey(key: string): Promise<ResolvedKey | AuthFailure> {
  // 1. Public demo key.
  if (key === DEMO_API_KEY) {
    return { keyId: DEMO_API_KEY, plan: 'demo', usagePartition: `demo:${DEMO_API_KEY}` };
  }

  // 2. Manually-provisioned keys from the PASSWORDIFY_API_KEYS app setting are
  //    treated as Pro (they are granted by hand, e.g. for partners).
  if (getConfiguredKeys().has(key)) {
    return { keyId: key, plan: 'pro', usagePartition: `envkey:${hashApiKey(key)}` };
  }

  // 3. Real keys provisioned through the dashboard, stored hashed.
  if (isStoreConfigured()) {
    const record = await getKeyByHash(hashApiKey(key));
    if (record && record.active) {
      return { keyId: record.keyHash, plan: record.plan, usagePartition: `user:${record.userId}` };
    }
  }

  return { ok: false, status: 401, code: 'unauthorized', message: 'Invalid API key.' };
}

export async function authorize(request: HttpRequest): Promise<AuthzResult> {
  const token = extractBearer(request);
  if (typeof token !== 'string') {
    return { ...token, headers: {} };
  }

  const resolved = await resolveKey(token);
  if ('ok' in resolved) {
    return { ...resolved, headers: {} };
  }

  const cfg = planConfig(resolved.plan);

  // Burst limit (per hour).
  const rl = rateLimit(resolved.keyId, cfg.burstPerHour, HOUR_MS);
  const headers = rateLimitHeaders(rl);
  if (!rl.ok) {
    return {
      ok: false,
      status: 429,
      code: 'rate_limited',
      message: 'Burst rate limit exceeded. Please slow down and try again shortly.',
      headers,
    };
  }

  // Monthly quota (only when durable storage is available).
  if (isStoreConfigured()) {
    const usage = await incrementUsage(resolved.usagePartition, cfg.monthlyQuota);
    headers['X-Quota-Limit'] = String(usage.limit);
    headers['X-Quota-Used'] = String(usage.used);
    headers['X-Quota-Remaining'] = String(Math.max(0, usage.limit - usage.used));
    headers['X-Quota-Period'] = usage.month;
    if (!usage.allowed) {
      return {
        ok: false,
        status: 429,
        code: 'quota_exceeded',
        message: `Monthly quota of ${cfg.monthlyQuota.toLocaleString('en-US')} requests exceeded for the ${cfg.label} plan. Upgrade for more headroom.`,
        headers,
      };
    }
  }

  return { ok: true, keyId: resolved.keyId, plan: resolved.plan, headers };
}

export { PLANS };
