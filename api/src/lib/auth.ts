import type { HttpRequest } from '@azure/functions';

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
