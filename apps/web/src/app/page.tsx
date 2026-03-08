'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import EvaluationOutput from '@/components/EvaluationOutput';

const PLACEHOLDERS = [
  'I value sweetness, flow, and elasticity but dislike glare and fatigue. What does this say about my preferences?',
  'After switching DACs, the system sounds sharper and more fatiguing. What changed?',
  'My system feels technically impressive but less engaging than before.',
  'The system sounds thin unless I turn it up.',
'I have about $500 for a DAC and prefer smooth, non-fatiguing sound. What should I consider?',
];


const EXAMPLES = [
  'I like the sweetness of the JOB amplifier.',
  'After switching DACs the system sounds brighter and more fatiguing.',
  
];

type ResultData =
  | { type: 'evaluate'; signals: any; result: any }
  | null;

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState<ResultData>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleRun() {
    if (!input.trim()) return;

    setLoading(true);
    setResultData(null);

    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    });

    if (res.ok) {
      const data = await res.json();
      setResultData({ type: 'evaluate', signals: data.signals, result: data.result });
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && e.metaKey) handleRun();
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '3.5rem 1.25rem 3rem',
        color: '#111',
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          borderTop: '4px solid #c4122f',
          width: 72,
          marginBottom: '1.25rem',
        }}
      />

      <h1
        style={{
          marginBottom: '0.5rem',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '2.25rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        Audio XX
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: '2rem',
          maxWidth: 620,
          color: '#444',
          fontSize: '1rem',
        }}
      >
        A listening advisor that interprets what you hear, reflects underlying system traits,
        and suggests the most sensible next step.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="audio-input"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#666',
          }}
        >
          Listening note
        </label>

        <textarea
          id="audio-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          style={{
            width: '100%',
            minHeight: 150,
            padding: '1rem',
            border: '1px solid #cfcfcf',
            borderRadius: 0,
            outline: 'none',
            fontSize: '1rem',
            lineHeight: 1.5,
            resize: 'vertical',
            background: '#fff',
            color: '#111',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        style={{
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid #ddd',
        }}
      >
        <div
          style={{
            marginBottom: '0.6rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#666',
          }}
        >
          Try an example
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#222',
                fontSize: '0.98rem',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: '#c4122f', marginRight: 6 }}>•</span>
              <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                {example}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={handleRun}
          disabled={loading || !input.trim()}
          style={{
            background: '#4a4a4a',
            color: '#fff',
            border: 'none',
            borderRadius: 0,
            padding: '0.75rem 1.25rem',
            fontSize: '0.95rem',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.65 : 1,
          }}
        >
          {loading ? 'Running…' : 'Run analysis'}
        </button>

        <span style={{ color: '#666', fontSize: '0.9rem' }}>⌘ + Enter</span>
      </div>

      {resultData && (
        <div style={{ marginTop: '1.75rem' }}>
          <hr style={{ border: 0, borderTop: '1px solid #d9d9d9', margin: '0 0 1.5rem 0' }} />
          <EvaluationOutput signals={resultData.signals} result={resultData.result} />
        </div>
      )}

      <div
        style={{
          marginTop: '3rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #ddd',
        }}
      >
        <Link
          href="/about"
          style={{
            color: '#666',
            fontSize: '0.9rem',
            textDecoration: 'none',
          }}
        >
          How this works
        </Link>
      </div>
    </div>
  );
}