import { useEffect, useRef, useState } from 'react';
import { analyzeStrength, scoreLabel, type StrengthResult } from '../../lib/strength';
import { checkBreach, type BreachResult } from '../../lib/breach';

const STRENGTH_VARS = ['--s0', '--s1', '--s2', '--s3', '--s4'];

type BreachState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; result: BreachResult }
  | { status: 'error' };

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
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

interface Props {
  compact?: boolean;
  autoFocus?: boolean;
  /** Seed the field so the tool opens in a realistic working state. */
  initial?: string;
}

export default function StrengthAnalyzer({ compact = false, autoFocus = false, initial = '' }: Props) {
  const [password, setPassword] = useState(initial);
  const [reveal, setReveal] = useState(false);
  const [strength, setStrength] = useState<StrengthResult | null>(null);
  const [breach, setBreach] = useState<BreachState>({ status: 'idle' });
  const debounced = useDebounced(password, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Local strength — instant, offline.
  useEffect(() => {
    let alive = true;
    if (!password) {
      setStrength(null);
      return;
    }
    analyzeStrength(password).then((r) => alive && setStrength(r));
    return () => {
      alive = false;
    };
  }, [password]);

  // Breach check — debounced, privacy-preserving.
  useEffect(() => {
    if (!debounced) {
      setBreach({ status: 'idle' });
      return;
    }
    const ctrl = new AbortController();
    setBreach({ status: 'checking' });
    checkBreach(debounced, ctrl.signal)
      .then((result) => setBreach({ status: 'done', result }))
      .catch((e) => {
        if (e?.name !== 'AbortError') setBreach({ status: 'error' });
      });
    return () => ctrl.abort();
  }, [debounced]);

  const score = strength?.score ?? -1;
  const color = score >= 0 ? `var(${STRENGTH_VARS[score]})` : 'var(--border-strong)';
  const hasInput = password.length > 0;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
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
          padding: '0.35rem 0.35rem 0.35rem 0.9rem',
          transition: 'border-color .16s, box-shadow .16s',
        }}
      >
        <input
          ref={inputRef}
          id="pwfy-analyzer-input"
          name="password"
          type={reveal ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Type or paste a password…"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Password to analyze"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            letterSpacing: reveal ? '0' : '0.06em',
            padding: '0.5rem 0',
          }}
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? 'Hide password' : 'Show password'}
          className="btn-ghost"
          style={{ height: '2.25rem', width: '2.25rem', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center' }}
        >
          <EyeIcon open={reveal} />
        </button>
      </div>

      {/* Meter */}
      <div>
        <div style={{ display: 'flex', gap: 6 }} role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={Math.max(0, score)} aria-label="Password strength">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              style={{
                height: 7,
                flex: 1,
                borderRadius: 999,
                background: hasInput && i <= score ? color : 'var(--surface-3)',
                transition: 'background-color .25s ease',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.6rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: hasInput && strength ? color : 'var(--text-faint)' }}>
            {!hasInput ? 'Awaiting input' : strength ? scoreLabel(score) : 'Analyzing…'}
          </span>
          {strength && (
            <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {strength.entropyBits.toFixed(1)} bits
            </span>
          )}
        </div>
      </div>

      {/* Stats + breach */}
      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Stat label="Guesses to crack" value={strength ? formatGuesses(strength.guesses) : '—'} />
          <Stat label="Offline crack time" value={strength ? strength.crackTimeOfflineFast : '—'} />
        </div>
      )}

      {/* Breach banner */}
      <BreachBanner state={breach} hasInput={hasInput} />

      {/* Feedback */}
      {strength && (strength.feedback.warning || strength.feedback.suggestions.length > 0) && (
        <div
          style={{
            display: 'grid',
            gap: '0.4rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            borderLeft: '2px solid var(--border-strong)',
            paddingLeft: '0.85rem',
          }}
        >
          {strength.feedback.warning && (
            <p style={{ color: 'var(--text)', fontWeight: 500 }}>{strength.feedback.warning}</p>
          )}
          {strength.feedback.suggestions.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      )}

      <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <LockIcon />
        Runs entirely in your browser. The breach check sends only the first 5 characters of a SHA-1 hash.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem 0.9rem',
      }}
    >
      <div className="eyebrow" style={{ fontSize: '0.62rem' }}>{label}</div>
      <div className="tnum" style={{ marginTop: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--text)', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function BreachBanner({ state, hasInput }: { state: BreachState; hasInput: boolean }) {
  if (!hasInput || state.status === 'idle') return null;

  let bg = 'var(--surface-2)';
  let fg = 'var(--text-muted)';
  let icon = <Spinner />;
  let text = 'Checking breach databases…';

  if (state.status === 'error') {
    text = 'Breach check unavailable right now.';
  } else if (state.status === 'done') {
    if (state.result.breached) {
      bg = 'color-mix(in srgb, var(--danger) 12%, transparent)';
      fg = 'var(--danger)';
      icon = <AlertIcon />;
      text = `Found in ${state.result.count.toLocaleString()} known breach${state.result.count === 1 ? '' : 'es'} — do not use it.`;
    } else {
      bg = 'color-mix(in srgb, var(--success) 12%, transparent)';
      fg = 'var(--success)';
      icon = <CheckIcon />;
      text = 'Not found in any known breach.';
    }
  }

  return (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        background: bg,
        color: fg,
        border: `1px solid color-mix(in srgb, ${fg} 26%, transparent)`,
        borderRadius: 'var(--radius-sm)',
        padding: '0.7rem 0.9rem',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

function formatGuesses(n: number): string {
  if (n < 1e6) return Math.round(n).toLocaleString();
  const exp = Math.floor(Math.log10(n));
  return `10^${exp}`;
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: 'pwfy-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes pwfy-spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
