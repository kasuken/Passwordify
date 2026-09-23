import { useEffect, useState } from 'react';

interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

interface MeResponse {
  authenticated: boolean;
  email: string;
  provider: string;
  plan: 'free' | 'pro' | 'demo';
  planLabel: string;
  quota: number;
  maxKeys: number;
  usage: { used: number; limit: number; month: string };
  subscriptionStatus: string | null;
  hasBilling: boolean;
  billingEnabled: boolean;
  key: { prefix: string; last4: string; createdAt: string } | null;
}

type Interval = 'monthly' | 'annual';

const LOGIN_PROVIDERS = [
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'aad', label: 'Continue with Microsoft' },
];

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

async function getPrincipal(): Promise<ClientPrincipal | null> {
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.clientPrincipal ?? null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [principal, setPrincipal] = useState<ClientPrincipal | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadMe() {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      setMe(null);
      return null;
    }
    if (res.status === 503) {
      setError('The account backend is not fully configured yet. Please check back shortly.');
      return null;
    }
    if (!res.ok) {
      setError('Something went wrong loading your account.');
      return null;
    }
    const data = (await res.json()) as MeResponse;
    setMe(data);
    return data;
  }

  useEffect(() => {
    (async () => {
      const p = await getPrincipal();
      setPrincipal(p);
      if (p) {
        const data = await loadMe();
        // Auto-start an upgrade if the pricing page sent ?upgrade=monthly|annual.
        const params = new URLSearchParams(window.location.search);
        const upgrade = params.get('upgrade');
        if (data && data.plan === 'free' && (upgrade === 'monthly' || upgrade === 'annual')) {
          startCheckout(upgrade as Interval);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createKey() {
    setBusy('key');
    setError(null);
    try {
      const res = await fetch('/api/keys', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNewKey(data.key as string);
      await loadMe();
    } catch {
      setError('Could not create the key. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function revokeKey() {
    if (!confirm('Revoke your current API key? Any app using it will stop working.')) return;
    setBusy('revoke');
    setError(null);
    try {
      await fetch('/api/keys', { method: 'DELETE' });
      setNewKey(null);
      await loadMe();
    } catch {
      setError('Could not revoke the key.');
    } finally {
      setBusy(null);
    }
  }

  async function startCheckout(interval: Interval) {
    setBusy('checkout');
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError(data?.error?.message || 'Could not start checkout. Please try again.');
      setBusy(null);
    } catch {
      setError('Could not start checkout. Please try again.');
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setError(null);
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError(data?.error?.message || 'Could not open the billing portal.');
      setBusy(null);
    } catch {
      setError('Could not open the billing portal.');
      setBusy(null);
    }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard?.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // --- Render ---------------------------------------------------------------

  if (loading) {
    return <div className="card p-8 text-sm text-muted">Loading your account…</div>;
  }

  if (!principal) {
    return (
      <div className="card p-8">
        <h2 className="text-lg font-semibold">Sign in to Passwordify</h2>
        <p className="mt-2 text-sm text-muted">
          Create a free account to get an API key. No password to remember — sign in with an
          existing account.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {LOGIN_PROVIDERS.map((p) => (
            <a
              key={p.id}
              href={`/.auth/login/${p.id}?post_login_redirect_uri=/dashboard`}
              className="btn btn-secondary w-full"
            >
              {p.label}
            </a>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          The free tools (strength, breach, generator) never require an account.
        </p>
      </div>
    );
  }

  const usedPct = me ? Math.min(100, Math.round((me.usage.used / Math.max(1, me.usage.limit)) * 100)) : 0;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Account header */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="text-lg font-semibold">{me?.email || principal.userDetails}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="pill">{me?.planLabel ?? '…'} plan</span>
          <a href="/.auth/logout?post_logout_redirect_uri=/" className="btn btn-ghost border border-line">
            Sign out
          </a>
        </div>
      </div>

      {/* Freshly-created key banner */}
      {newKey && (
        <div className="card border-accent p-6">
          <h3 className="text-base font-semibold">Your new API key</h3>
          <p className="mt-1 text-sm text-muted">
            Copy it now — for your security, it won’t be shown again.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="chip-mono flex-1 overflow-x-auto whitespace-nowrap">{newKey}</code>
            <button type="button" onClick={copyKey} className="btn btn-primary">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* API key */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold">API key</h3>
          {me?.key ? (
            <div className="flex gap-2">
              <button type="button" onClick={createKey} disabled={busy === 'key'} className="btn btn-secondary">
                {busy === 'key' ? 'Rotating…' : 'Rotate'}
              </button>
              <button type="button" onClick={revokeKey} disabled={busy === 'revoke'} className="btn btn-ghost border border-line">
                Revoke
              </button>
            </div>
          ) : (
            <button type="button" onClick={createKey} disabled={busy === 'key'} className="btn btn-primary">
              {busy === 'key' ? 'Creating…' : 'Create key'}
            </button>
          )}
        </div>
        {me?.key ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <code className="chip-mono">{me.key.prefix}…{me.key.last4}</code>
            <span className="text-muted">
              Created {me.key.createdAt ? new Date(me.key.createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            You don’t have an API key yet. Create one to start calling the API.
          </p>
        )}
        <p className="mt-4 text-xs text-muted">
          Authenticate every request with <code className="chip-mono">X-API-Key: &lt;key&gt;</code>.
          See the <a href="/docs" className="text-accent underline-offset-2 hover:underline">docs</a>.
        </p>
      </div>

      {/* Usage */}
      {me && (
        <div className="card p-6">
          <h3 className="text-base font-semibold">Usage this month</h3>
          <div className="mt-4 flex items-baseline justify-between text-sm">
            <span className="tnum font-semibold">{fmt(me.usage.used)}</span>
            <span className="text-muted">of {fmt(me.usage.limit)} requests</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${usedPct}%`, background: usedPct >= 90 ? 'var(--danger)' : 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {/* Plan / billing */}
      {me && (
        <div className="card p-6">
          <h3 className="text-base font-semibold">Plan &amp; billing</h3>
          {me.plan === 'pro' ? (
            <>
              <p className="mt-2 text-sm text-muted">
                You’re on <span className="text-ink">Pro</span>
                {me.subscriptionStatus ? ` (${me.subscriptionStatus})` : ''}. Manage your payment
                method, switch billing period, or cancel anytime.
              </p>
              <button type="button" onClick={openPortal} disabled={busy === 'portal'} className="btn btn-secondary mt-4">
                {busy === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                Upgrade to Pro for 100,000 requests/mo, 5 keys, and higher burst limits.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => startCheckout('monthly')} disabled={busy === 'checkout'} className="btn btn-primary">
                  Upgrade — $2/mo
                </button>
                <button type="button" onClick={() => startCheckout('annual')} disabled={busy === 'checkout'} className="btn btn-secondary">
                  Annual — $1.50/mo
                </button>
              </div>
              {!me.billingEnabled && (
                <p className="mt-3 text-xs text-muted">Billing is being set up — check back soon.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
