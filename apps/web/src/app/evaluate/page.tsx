'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import EvaluationOutput from '@/components/EvaluationOutput';

interface System { id: string; name: string; }

export default function EvaluatePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [systems, setSystems] = useState<System[]>([]);
  const [systemId, setSystemId] = useState(searchParams.get('systemId') || '');
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<{ signals: any; result: any } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    if (!systemId || !inputText.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemId, inputText }),
    });
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  if (status !== 'authenticated') return null;

  return (
    <div>
      <h1>Evaluate</h1>
      <p className="small muted mb-2">
        Describe what you are hearing. The system will analyze your impressions
        and provide trait-based suggestions with trade-offs and risks.
      </p>

      <form onSubmit={handleEvaluate}>
        <div className="field">
          <label>System</label>
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)} required>
            <option value="">Select a system...</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>What are you hearing?</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. The system sounds a bit thin and the treble is fatiguing after about 30 minutes. I listen mostly at night at low volume."
            style={{ minHeight: 140 }}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Evaluating...' : 'Evaluate'}
        </button>
      </form>

      {result && (
        <div className="mt-2">
          <hr />
          <EvaluationOutput signals={result.signals} result={result.result} />
        </div>
      )}
    </div>
  );
}
