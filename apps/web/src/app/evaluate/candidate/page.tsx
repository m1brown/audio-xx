'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

interface System { id: string; name: string; }
interface Component { id: string; name: string; brand: string; category: string; isReference: boolean; }

interface CandidateResult {
  candidate: { id: string; name: string; brand: string; category: string };
  replacing: { id: string; name: string; brand: string } | null;
  trait_movement: Record<string, { from: string; to: string; direction: string }>;
  regression_risks: string[];
  candidate_risks: string[];
  verdict: string;
  reference_note: string | null;
}

export default function EvaluateCandidatePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [systems, setSystems] = useState<System[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [systemId, setSystemId] = useState(searchParams.get('systemId') || '');
  const [candidateId, setCandidateId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  async function search(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setComponents([]); return; }
    const res = await fetch(`/api/components?q=${encodeURIComponent(q)}`);
    if (res.ok) setComponents(await res.json());
  }

  async function handleEvaluate() {
    if (!systemId || !candidateId) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/evaluate/candidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemId, candidateComponentId: candidateId }),
    });
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  if (status !== 'authenticated') return null;

  return (
    <div>
      <h1>Evaluate candidate</h1>
      <p className="small muted mb-2">
        Select a component from the catalog, then evaluate it against a saved system.
      </p>

      <div className="field">
        <label>System</label>
        <select value={systemId} onChange={(e) => setSystemId(e.target.value)} required>
          <option value="">Select a system...</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Search for candidate</label>
        <input placeholder="Search by name or brand..." value={searchQuery} onChange={(e) => search(e.target.value)} />
      </div>

      {components.length > 0 && (
        <div className="mb-2">
          {components.map((c) => (
            <div
              key={c.id}
              className="item-row flex-between"
              style={{ cursor: 'pointer', background: candidateId === c.id ? '#f5f5f5' : 'transparent' }}
              onClick={() => setCandidateId(c.id)}
            >
              <span className="small">
                {c.brand} {c.name}
                <span className="muted"> · {c.category.replace(/_/g, ' ')}</span>
                {c.isReference && <span className="muted"> · reference</span>}
              </span>
              {candidateId === c.id && <span className="small success">selected</span>}
            </div>
          ))}
        </div>
      )}

      <button onClick={handleEvaluate} className="btn btn-primary mb-2" disabled={loading || !systemId || !candidateId}>
        {loading ? 'Evaluating...' : 'Evaluate'}
      </button>

      {result && (
        <div>
          <hr />

          {result.reference_note && (
            <div className="section">
              <p className="small muted" style={{ fontStyle: 'italic' }}>{result.reference_note}</p>
              <p className="small muted mt-1" style={{ fontStyle: 'italic' }}>
                Some reference systems use equipment that is no longer made or not sold through
                commercial partners. These systems are included to explain listening trade-offs,
                not to sell products.
              </p>
            </div>
          )}

          <div className="flex-between mb-1">
            <strong>{result.candidate.brand} {result.candidate.name}</strong>
            <span className={`verdict ${
              result.verdict === 'proceed' ? 'verdict-good' :
              result.verdict === 'pass' ? 'verdict-bad' : 'verdict-caution'
            }`}>
              {result.verdict.replace(/_/g, ' ')}
            </span>
          </div>

          {result.replacing && (
            <p className="small muted mb-1">Replacing: {result.replacing.brand} {result.replacing.name}</p>
          )}

          {Object.keys(result.trait_movement).length > 0 && (
            <>
              <h3 className="mt-2">Trait movement</h3>
              {Object.entries(result.trait_movement).map(([trait, mv]) => (
                <div key={trait} className="item-row flex-between small">
                  <span>{trait.replace(/_/g, ' ')}</span>
                  <span>
                    <span className="muted">{mv.from}</span>
                    {' → '}
                    <span className={mv.direction === 'improved' ? 'success' : mv.direction === 'reduced' ? 'danger' : 'muted'}>
                      {mv.to}
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}

          {result.regression_risks.length > 0 && (
            <>
              <h3 className="mt-2">Regression risks</h3>
              <ul className="plain">
                {result.regression_risks.map((r, i) => <li key={i} className="small warning">{r}</li>)}
              </ul>
            </>
          )}

          {result.candidate_risks.length > 0 && (
            <>
              <h3 className="mt-2">Known risks</h3>
              <ul className="plain">
                {result.candidate_risks.map((r, i) => <li key={i} className="small muted">{r}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
