'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface System { id: string; name: string; }

interface CompareResult {
  systemA: { id: string; name: string };
  systemB: { id: string; name: string };
  trait_comparison: Record<string, { systemA: number; systemB: number; delta: string }>;
  component_diffs: {
    only_in_a: Array<{ name: string; brand: string; category: string }>;
    only_in_b: Array<{ name: string; brand: string; category: string }>;
  };
  tradeoffs: string[];
  note: string;
}

export default function ComparePage() {
  const { status } = useSession();
  const router = useRouter();
  const [systems, setSystems] = useState<System[]>([]);
  const [systemAId, setSystemAId] = useState('');
  const [systemBId, setSystemBId] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  async function handleCompare() {
    if (!systemAId || !systemBId) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemAId, systemBId }),
    });
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  if (status !== 'authenticated') return null;

  return (
    <div>
      <h1>Compare systems</h1>
      <p className="small muted mb-2">
        Compare two saved systems. See trait differences, component diffs, and trade-offs.
      </p>

      <div className="grid-2 mb-1">
        <div className="field">
          <label>System A</label>
          <select value={systemAId} onChange={(e) => setSystemAId(e.target.value)}>
            <option value="">Select...</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>System B</label>
          <select value={systemBId} onChange={(e) => setSystemBId(e.target.value)}>
            <option value="">Select...</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <button onClick={handleCompare} className="btn btn-primary mb-2" disabled={loading || !systemAId || !systemBId}>
        {loading ? 'Comparing...' : 'Compare'}
      </button>

      {result && (
        <div>
          <hr />

          <div className="grid-2 mb-1">
            <div>
              <h3>Only in {result.systemA.name}</h3>
              {result.component_diffs.only_in_a.length === 0 ? (
                <p className="small muted">No unique components</p>
              ) : (
                <ul className="plain">
                  {result.component_diffs.only_in_a.map((c, i) => (
                    <li key={i} className="small">{c.brand} {c.name} <span className="muted">({c.category})</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Only in {result.systemB.name}</h3>
              {result.component_diffs.only_in_b.length === 0 ? (
                <p className="small muted">No unique components</p>
              ) : (
                <ul className="plain">
                  {result.component_diffs.only_in_b.map((c, i) => (
                    <li key={i} className="small">{c.brand} {c.name} <span className="muted">({c.category})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <h3>Trait comparison</h3>
          <p className="small muted mb-1">{result.note}</p>
          {Object.entries(result.trait_comparison).map(([trait, comp]) => (
            <div key={trait} className="item-row flex-between small">
              <span>{trait.replace(/_/g, ' ')}</span>
              <span className={comp.delta === 'similar' ? 'muted' : ''}>{comp.delta}</span>
            </div>
          ))}

          {result.tradeoffs.length > 0 && (
            <>
              <h3 className="mt-2">Key trade-offs</h3>
              <ul className="plain">
                {result.tradeoffs.map((t, i) => <li key={i} className="small">{t}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
