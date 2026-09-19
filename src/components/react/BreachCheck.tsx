import { useEffect, useRef, useState } from 'react';
import { checkBreach, type BreachResult } from '../../lib/breach';
import { sha1Hex } from '../../lib/sha1';

type State =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; result: BreachResult; prefix: string; suffix: string }
  | { status: 'error' };

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function BreachCheck() {
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });
  const debounced = useDebounced(password, 350);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!debounced) {
      setState({ status: 'idle' });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: 'checking' });
    (async () => {
      try {
        const hash = await sha1Hex(debounced);
        const result = await checkBreach(debounced, ctrl.signal);
        setState({
          status: 'done',
          result,
          prefix: hash.slice(0, 5),
          suffix: hash.slice(5),
        });
      } catch (e: any) {
        if (e?.name !== 'AbortError') setState({ status: 'error' });
      }
    })();
    return () => ctrl.abort();
  }, [debounced]);

  const breached = state.status === 'done' && state.result.breached;
  const safe = state.status === 'done' && !state.result.breached;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* Input */}
      <div
        className="ring-accent"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.35rem 0.35rem 0.35rem 0.95rem',
          transition: 'border-color .16s, box-shadow .16s',
        }}
      >
        <input
          ref={inputRef}
          id="pwfy-breach-input"
          name="password"
          type={reveal ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter a password to check…"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Password to check for breaches"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '1.05rem',
            letterSpacing: reveal ? '0' : '0.06em',
            padding: '0.6rem 0',
          }}
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? 'Hide password' : 'Show password'}
          className="btn-ghost"
          style={{ height: '2.4rem', width: '2.4rem', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center' }}
        >
          <EyeIcon open={reveal} />
        </button>
      </div>

      {/* Result banner */}
      {state.status !== 'idle' && (
        <div
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
            padding: '1.1rem 1.15rem',
            borderRadius: 'var(--radius-md)',
            background:
              state.status === 'checking'
                ? 'var(--surface-2)'
                : breached
                  ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
                  : safe
                    ? 'color-mix(in srgb, var(--success) 12%, transparent)'
                    : 'var(--surface-2)',
            border: `1px solid ${
              breached
                ? 'color-mix(in srgb, var(--danger) 30%, transparent)'
                : safe
                  ? 'color-mix(in srgb, var(--success) 30%, transparent)'
                  : 'var(--border)'
            }`,
            color: breached ? 'var(--danger)' : safe ? 'var(--success)' : 'var(--text-muted)',
          }}
        >
          <span style={{ marginTop: 2 }}>
            {state.status === 'checking' ? <Spinner /> : breached ? <AlertIcon /> : safe ? <ShieldCheck /> : <AlertIcon />}
          </span>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <span style={{ fontWeight: 650, fontSize: '1.05rem' }}>
              {state.status === 'checking' && 'Checking 900M+ breached passwords…'}
              {breached && 'This password has been breached'}
              {safe && 'No breach found'}
              {state.status === 'error' && 'Service unavailable'}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {breached &&
                state.status === 'done' &&
                `Seen ${state.result.count.toLocaleString()} time${state.result.count === 1 ? '' : 's'} in known data breaches. Never use it — attackers try leaked passwords first.`}
              {safe && "It doesn't appear in Have I Been Pwned's corpus. That's necessary, but not sufficient — still make it long and unique."}
              {state.status === 'error' && 'Could not reach the breach service. Check your connection and try again.'}
            </span>
          </div>
        </div>
      )}

      {/* k-anonymity transparency */}
      {state.status === 'done' && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span className="eyebrow" style={{ fontSize: '0.66rem' }}>What actually left your browser</span>
          </div>
          <div style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: 1.9, overflowX: 'auto' }}>
            <div style={{ color: 'var(--text-faint)' }}>SHA-1(password) =</div>
            <div style={{ whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{state.prefix}</span>
              <span style={{ color: 'var(--text-muted)' }}>{state.suffix}</span>
            </div>
            <div style={{ marginTop: '0.6rem', color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', fontSize: '0.82rem', whiteSpace: 'normal' }}>
              Only the <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{state.prefix}</span> prefix
              was sent to the API. It returned every hash sharing that prefix, and the match happened here on your device. Your password — and its full hash — never left.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.6 4.4M6.1 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3-.5" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: 'pwfy-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes pwfy-spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
function ShieldCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
