import { useCallback, useEffect, useState } from 'react';
import {
  generatePassword,
  generatePassphrase,
  passwordEntropyBits,
  passphraseEntropyBits,
  entropyLabel,
  type PasswordOptions,
  type PassphraseOptions,
} from '../../lib/generate';

type Mode = 'password' | 'passphrase';

const STRENGTH_VARS = ['--s0', '--s1', '--s2', '--s3', '--s4'];
function entropyTier(bits: number): number {
  if (bits < 40) return 0;
  if (bits < 60) return 1;
  if (bits < 80) return 2;
  if (bits < 120) return 3;
  return 4;
}

const SEPARATORS = [
  { label: 'hyphen', value: '-' },
  { label: 'period', value: '.' },
  { label: 'underscore', value: '_' },
  { label: 'space', value: ' ' },
];

export default function Generator() {
  const [mode, setMode] = useState<Mode>('password');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const [pw, setPw] = useState<PasswordOptions>({
    length: 20,
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true,
    avoidAmbiguous: false,
  });
  const [pp, setPp] = useState<PassphraseOptions>({
    words: 5,
    separator: '-',
    capitalize: true,
    includeNumber: true,
  });

  const regenerate = useCallback(async () => {
    if (mode === 'password') {
      setOutput(generatePassword(pw));
    } else {
      setOutput(await generatePassphrase(pp));
    }
    setCopied(false);
  }, [mode, pw, pp]);

  // Regenerate whenever mode/options change.
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const bits = mode === 'password' ? passwordEntropyBits(pw) : passphraseEntropyBits(pp);
  const tier = entropyTier(bits);
  const color = `var(${STRENGTH_VARS[tier]})`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Generator mode"
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          width: 'fit-content',
        }}
      >
        {(['password', 'passphrase'] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 550,
              textTransform: 'capitalize',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color .15s, color .15s',
              background: mode === m ? 'var(--surface)' : 'transparent',
              color: mode === m ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Output */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.1rem 1.15rem',
            minHeight: '4rem',
          }}
        >
          <output
            aria-live="polite"
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(1.05rem, 2.4vw, 1.4rem)',
              wordBreak: 'break-all',
              color: 'var(--text)',
              lineHeight: 1.35,
            }}
          >
            {output || ' '}
          </output>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={regenerate}
              aria-label="Regenerate"
              title="Regenerate"
              className="btn-ghost"
              style={{ height: '2.6rem', width: '2.6rem', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}
            >
              <RefreshIcon />
            </button>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy to clipboard"
              title="Copy"
              className="btn-primary"
              style={{ height: '2.6rem', minWidth: '5.6rem', borderRadius: 'var(--radius-sm)', padding: '0 0.9rem' }}
            >
              {copied ? (
                <>
                  <CheckIcon /> Copied
                </>
              ) : (
                <>
                  <CopyIcon /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Entropy readout */}
        <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: 5, flex: 1 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 999,
                  background: i <= tier ? color : 'var(--surface-3)',
                  transition: 'background-color .25s',
                }}
              />
            ))}
          </div>
          <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {Math.round(bits)} bits · <span style={{ color }}>{entropyLabel(bits)}</span>
          </span>
        </div>
      </div>

      {/* Controls */}
      {mode === 'password' ? (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <Slider
            label="Length"
            value={pw.length}
            min={8}
            max={64}
            onChange={(length) => setPw((p) => ({ ...p, length }))}
          />
          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Toggle label="Lowercase (a–z)" checked={pw.lowercase} onChange={(v) => setPw((p) => ({ ...p, lowercase: v }))} />
            <Toggle label="Uppercase (A–Z)" checked={pw.uppercase} onChange={(v) => setPw((p) => ({ ...p, uppercase: v }))} />
            <Toggle label="Numbers (0–9)" checked={pw.numbers} onChange={(v) => setPw((p) => ({ ...p, numbers: v }))} />
            <Toggle label="Symbols (!@#…)" checked={pw.symbols} onChange={(v) => setPw((p) => ({ ...p, symbols: v }))} />
            <Toggle label="Avoid look-alikes" checked={pw.avoidAmbiguous} onChange={(v) => setPw((p) => ({ ...p, avoidAmbiguous: v }))} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <Slider
            label="Words"
            value={pp.words}
            min={3}
            max={10}
            onChange={(words) => setPp((p) => ({ ...p, words }))}
          />
          <div>
            <label className="eyebrow" style={{ fontSize: '0.66rem', display: 'block', marginBottom: '0.5rem' }}>Separator</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SEPARATORS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setPp((p) => ({ ...p, separator: s.value }))}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${pp.separator === s.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: pp.separator === s.value ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: pp.separator === s.value ? 'var(--accent)' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Toggle label="Capitalize words" checked={pp.capitalize} onChange={(v) => setPp((p) => ({ ...p, capitalize: v }))} />
            <Toggle label="Include a number" checked={pp.includeNumber} onChange={(v) => setPp((p) => ({ ...p, includeNumber: v }))} />
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.55rem' }}>
        <label htmlFor={`slider-${label}`} className="eyebrow" style={{ fontSize: '0.66rem' }}>{label}</label>
        <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600, color: 'var(--accent)' }}>{value}</span>
      </div>
      <input
        id={`slider-${label}`}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pwfy-range"
        style={{ width: '100%' }}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        cursor: 'pointer',
        padding: '0.65rem 0.8rem',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${checked ? 'var(--accent-line)' : 'var(--border)'}`,
        background: checked ? 'var(--accent-soft)' : 'var(--surface-2)',
        transition: 'background-color .15s, border-color .15s',
        userSelect: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          background: checked ? 'var(--accent)' : 'transparent',
          border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
          color: 'var(--accent-contrast)',
          transition: 'background-color .15s, border-color .15s',
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{label}</span>
    </label>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
