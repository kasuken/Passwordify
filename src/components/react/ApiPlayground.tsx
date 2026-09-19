import { useEffect, useState, type ReactNode } from 'react';
import { analyzeStrength } from '../../lib/strength';
import { checkBreach } from '../../lib/breach';
import { validatePassword } from '../../lib/policy';
import { generatePassword, passwordEntropyBits } from '../../lib/generate';

type Endpoint = 'strength' | 'breach' | 'validate' | 'generate';

const ENDPOINTS: { id: Endpoint; label: string; needsPassword: boolean }[] = [
  { id: 'strength', label: '/v1/strength', needsPassword: true },
  { id: 'breach', label: '/v1/breach', needsPassword: true },
  { id: 'validate', label: '/v1/validate', needsPassword: true },
  { id: 'generate', label: '/v1/generate', needsPassword: false },
];

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; body: unknown }
  | { status: 'error' };

export default function ApiPlayground() {
  const [endpoint, setEndpoint] = useState<Endpoint>('validate');
  const [password, setPassword] = useState('Summer2024!');
  const [state, setState] = useState<RunState>({ status: 'idle' });

  const meta = ENDPOINTS.find((e) => e.id === endpoint)!;

  async function run() {
    setState({ status: 'running' });
    try {
      let body: unknown;
      if (endpoint === 'strength') {
        const r = await analyzeStrength(password);
        body = {
          score: r.score,
          guesses: Math.round(r.guesses),
          entropyBits: Number(r.entropyBits.toFixed(1)),
          crackTimeOfflineFast: r.crackTimeOfflineFast,
          feedback: r.feedback,
        };
      } else if (endpoint === 'breach') {
        const r = await checkBreach(password);
        body = { breached: r.breached, count: r.count };
      } else if (endpoint === 'validate') {
        const r = await validatePassword(password);
        body = {
          valid: r.valid,
          score: r.score,
          breached: r.breached,
          breachCount: r.breachCount,
          violations: r.violations,
        };
      } else {
        const opts = {
          length: 20,
          lowercase: true,
          uppercase: true,
          numbers: true,
          symbols: true,
          avoidAmbiguous: false,
        };
        body = {
          passwords: [generatePassword(opts), generatePassword(opts)],
          entropyBits: Number(passwordEntropyBits(opts).toFixed(1)),
        };
      }
      setState({ status: 'done', body });
    } catch {
      setState({ status: 'error' });
    }
  }

  // Open in a working state.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const requestBody =
    endpoint === 'generate'
      ? '{ "length": 20, "count": 2 }'
      : `{ "password": ${JSON.stringify(password)} }`;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Endpoint picker */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ENDPOINTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setEndpoint(e.id)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 550,
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              border: `1px solid ${endpoint === e.id ? 'var(--accent)' : 'var(--border)'}`,
              background: endpoint === e.id ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: endpoint === e.id ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Password input (when relevant) */}
      {meta.needsPassword && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.15rem 0.15rem 0.15rem 0.75rem',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-faint)' }}>password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            aria-label="Test password for the API playground"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              padding: '0.55rem 0',
            }}
          />
          <button className="btn btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }} onClick={run}>
            Run
          </button>
        </div>
      )}
      {!meta.needsPassword && (
        <button className="btn btn-primary" style={{ width: 'fit-content', padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={run}>
          Run request
        </button>
      )}

      {/* Request + response */}
      <div className="terminal">
        <div className="terminal-bar">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)' }}>POST</span>
          <span className="terminal-title" style={{ marginLeft: 0 }}>/api{meta.label}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-faint)' }}>
            {state.status === 'running' ? '· running' : state.status === 'done' ? '· 200 OK' : ''}
          </span>
        </div>
        <div className="terminal-body" style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <div style={{ color: 'var(--text-faint)', fontSize: '0.72rem', marginBottom: 4 }}>REQUEST BODY</div>
            <code style={{ color: 'var(--text-muted)' }}>{requestBody}</code>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
            <div style={{ color: 'var(--text-faint)', fontSize: '0.72rem', marginBottom: 4 }}>RESPONSE</div>
            {state.status === 'done' ? (
              <Json value={state.body} />
            ) : state.status === 'error' ? (
              <code style={{ color: 'var(--danger)' }}>{'{ "error": "breach service unavailable" }'}</code>
            ) : (
              <code style={{ color: 'var(--text-faint)' }}>…</code>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
        This playground runs in your browser with the same engine that powers the API — no key needed here.
      </p>
    </div>
  );
}

/** Minimal, theme-aware JSON pretty-printer. */
function Json({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const lines = text.split('\n');
  return (
    <code style={{ display: 'block' }}>
      {lines.map((line, i) => (
        <div key={i}>{colorize(line)}</div>
      ))}
    </code>
  );
}

function colorize(line: string): ReactNode {
  // key: "..."
  const keyMatch = line.match(/^(\s*)"([^"]+)":\s*(.*)$/);
  if (keyMatch) {
    const [, indent, key, rest] = keyMatch;
    return (
      <>
        {indent}
        <span style={{ color: 'var(--text)' }}>"{key}"</span>
        <span style={{ color: 'var(--text-muted)' }}>: </span>
        {colorizeValue(rest)}
      </>
    );
  }
  return <span style={{ color: 'var(--text-muted)' }}>{line}</span>;
}

function colorizeValue(v: string): ReactNode {
  const trailing = v.endsWith(',') ? ',' : '';
  const val = trailing ? v.slice(0, -1) : v;
  let color = 'var(--text-muted)';
  if (/^".*"$/.test(val)) color = 'var(--s3)';
  else if (/^-?\d/.test(val)) color = 'var(--s1)';
  else if (val === 'true' || val === 'false' || val === 'null') color = 'var(--accent)';
  return (
    <>
      <span style={{ color }}>{val}</span>
      <span style={{ color: 'var(--text-muted)' }}>{trailing}</span>
    </>
  );
}
