import { TableClient, TableServiceClient, RestError } from '@azure/data-tables';
import type { PlanId } from './plans';

/**
 * Durable persistence for users, API keys and monthly usage, backed by Azure
 * Table Storage (cheap, serverless-friendly, no server to run).
 *
 * The connection string comes from `PASSWORDIFY_STORAGE_CONNECTION`, falling
 * back to the Functions host's own `AzureWebJobsStorage`. When neither is set
 * (e.g. a bare local `func start` with no storage), the store reports itself as
 * unconfigured and callers degrade gracefully instead of crashing.
 */
const CONN = process.env.PASSWORDIFY_STORAGE_CONNECTION || process.env.AzureWebJobsStorage || '';
const ALLOW_INSECURE = /UseDevelopmentStorage=true|devstoreaccount1/i.test(CONN);

const USERS_TABLE = 'pwfyusers';
const KEYS_TABLE = 'pwfykeys';
const USAGE_TABLE = 'pwfyusage';

export function isStoreConfigured(): boolean {
  return CONN.length > 0;
}

const clientCache = new Map<string, TableClient>();
function table(name: string): TableClient {
  let client = clientCache.get(name);
  if (!client) {
    client = TableClient.fromConnectionString(CONN, name, { allowInsecureConnection: ALLOW_INSECURE });
    clientCache.set(name, client);
  }
  return client;
}

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  const service = TableServiceClient.fromConnectionString(CONN, { allowInsecureConnection: ALLOW_INSECURE });
  await Promise.all(
    [USERS_TABLE, KEYS_TABLE, USAGE_TABLE].map((name) =>
      service.createTable(name).catch((err: unknown) => {
        // 409 = already exists; anything else is a real failure.
        if (err instanceof RestError && err.statusCode === 409) return;
        throw err;
      })
    )
  );
  tablesEnsured = true;
}

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

// --- Users -----------------------------------------------------------------

export interface UserRecord {
  userId: string;
  email: string;
  provider: string;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  /** ISO timestamp of the last live plan verification against Stripe. */
  planCheckedAt?: string;
  keyHash?: string;
  keyPrefix?: string;
  keyLast4?: string;
  keyCreatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function toUser(entity: Record<string, unknown>): UserRecord {
  return {
    userId: String(entity.rowKey),
    email: (entity.email as string) ?? '',
    provider: (entity.provider as string) ?? '',
    plan: ((entity.plan as PlanId) ?? 'free'),
    stripeCustomerId: (entity.stripeCustomerId as string) || undefined,
    stripeSubscriptionId: (entity.stripeSubscriptionId as string) || undefined,
    subscriptionStatus: (entity.subscriptionStatus as string) || undefined,
    planCheckedAt: (entity.planCheckedAt as string) || undefined,
    keyHash: (entity.keyHash as string) || undefined,
    keyPrefix: (entity.keyPrefix as string) || undefined,
    keyLast4: (entity.keyLast4 as string) || undefined,
    keyCreatedAt: (entity.keyCreatedAt as string) || undefined,
    createdAt: (entity.createdAt as string) ?? '',
    updatedAt: (entity.updatedAt as string) ?? '',
  };
}

/** Drop undefined values — Table Storage rejects them. */
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function getUser(userId: string): Promise<UserRecord | null> {
  await ensureTables();
  try {
    const entity = await table(USERS_TABLE).getEntity('user', userId);
    return toUser(entity as unknown as Record<string, unknown>);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function upsertUser(user: UserRecord): Promise<void> {
  await ensureTables();
  const entity = clean({ partitionKey: 'user', rowKey: user.userId, ...user, userId: undefined }) as {
    partitionKey: string;
    rowKey: string;
  } & Record<string, unknown>;
  await table(USERS_TABLE).upsertEntity(entity, 'Merge');
}

/**
 * Get an existing user or create a default Free record for a first-time
 * visitor. Also refreshes email/provider if they have changed.
 */
export async function getOrCreateUser(userId: string, email: string, provider: string): Promise<UserRecord> {
  const existing = await getUser(userId);
  const now = new Date().toISOString();
  if (existing) {
    if ((email && existing.email !== email) || (provider && existing.provider !== provider)) {
      const updated = { ...existing, email: email || existing.email, provider: provider || existing.provider, updatedAt: now };
      await upsertUser(updated);
      return updated;
    }
    return existing;
  }
  const created: UserRecord = { userId, email, provider, plan: 'free', createdAt: now, updatedAt: now };
  await upsertUser(created);
  return created;
}

// --- API keys --------------------------------------------------------------

export interface KeyRecord {
  keyHash: string;
  userId: string;
  plan: PlanId;
  active: boolean;
  prefix: string;
  last4: string;
  createdAt: string;
  /** ISO timestamp of the last live plan verification for this key. */
  planCheckedAt?: string;
}

export async function getKeyByHash(keyHash: string): Promise<KeyRecord | null> {
  await ensureTables();
  try {
    const entity = await table(KEYS_TABLE).getEntity('key', keyHash);
    const e = entity as unknown as Record<string, unknown>;
    return {
      keyHash,
      userId: String(e.userId),
      plan: (e.plan as PlanId) ?? 'free',
      active: e.active === true,
      prefix: (e.prefix as string) ?? '',
      last4: (e.last4 as string) ?? '',
      createdAt: (e.createdAt as string) ?? '',
      planCheckedAt: (e.planCheckedAt as string) || undefined,
    };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function putKey(key: KeyRecord): Promise<void> {
  await ensureTables();
  await table(KEYS_TABLE).upsertEntity(
    clean({
      partitionKey: 'key',
      rowKey: key.keyHash,
      userId: key.userId,
      plan: key.plan,
      active: key.active,
      prefix: key.prefix,
      last4: key.last4,
      createdAt: key.createdAt,
      planCheckedAt: key.planCheckedAt,
    }) as { partitionKey: string; rowKey: string } & Record<string, unknown>,
    'Replace'
  );
}

export async function deactivateKey(keyHash: string): Promise<void> {
  await ensureTables();
  try {
    await table(KEYS_TABLE).updateEntity({ partitionKey: 'key', rowKey: keyHash, active: false }, 'Merge');
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

/** Record a key's current plan and when it was last verified against Stripe. */
export async function setKeyPlanChecked(keyHash: string, plan: PlanId, checkedAt: string): Promise<void> {
  await ensureTables();
  try {
    await table(KEYS_TABLE).updateEntity({ partitionKey: 'key', rowKey: keyHash, plan, planCheckedAt: checkedAt }, 'Merge');
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

// --- Monthly usage ---------------------------------------------------------

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
}

export interface UsageResult {
  used: number;
  limit: number;
  allowed: boolean;
  month: string;
}

/**
 * Atomically increment the monthly counter for `partition` and report whether
 * the request is within `limit`. Uses optimistic concurrency (ETag) with a few
 * retries; on persistent contention or storage error it fails OPEN so we never
 * block a paying customer because of a metering hiccup.
 */
export async function incrementUsage(partition: string, limit: number): Promise<UsageResult> {
  const month = currentMonth();
  const client = table(USAGE_TABLE);
  await ensureTables();

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      let count = 0;
      let etag: string | undefined;
      try {
        const entity = await client.getEntity(partition, month);
        count = Number((entity as unknown as Record<string, unknown>).count) || 0;
        etag = (entity as unknown as { etag?: string }).etag;
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }

      const next = count + 1;
      const entity = { partitionKey: partition, rowKey: month, count: next };
      if (etag) {
        await client.updateEntity(entity, 'Replace', { etag });
      } else {
        await client.createEntity(entity);
      }
      return { used: next, limit, allowed: next <= limit, month };
    } catch (err) {
      // 412 = ETag mismatch, 409 = create race — retry. Otherwise fail open.
      if (err instanceof RestError && (err.statusCode === 412 || err.statusCode === 409)) continue;
      return { used: 0, limit, allowed: true, month };
    }
  }
  return { used: 0, limit, allowed: true, month };
}

export async function getUsage(partition: string): Promise<{ used: number; month: string }> {
  await ensureTables();
  const month = currentMonth();
  try {
    const entity = await table(USAGE_TABLE).getEntity(partition, month);
    return { used: Number((entity as unknown as Record<string, unknown>).count) || 0, month };
  } catch (err) {
    if (isNotFound(err)) return { used: 0, month };
    throw err;
  }
}
