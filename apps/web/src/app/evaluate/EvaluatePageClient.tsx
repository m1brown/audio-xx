'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import EvaluationOutput from '@/components/EvaluationOutput';

interface System { id: string; name: string; }

interface EvaluationResult {
  signals: any;
  result: any;
}

export default function EvaluatePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [systems, setSystems] = useState<System[]>([]);
  const [systemId, setSystemId] = useState(searchParams.get('systemId') || '');
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemId: systemId || undefined, input: inputText }),
    });
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  if (status !== 'authenticated') return null;

  return (
    <div>
      <h1>Evaluate</h1>
      <p className="small muted mb-2">
        Describe your listening priorities and system characteristics. The system will suggest aligned component directions.
      </p>

      <form onSubmit={handleEvaluate}>
        <div className="field">
          <label>System (optional)</label>
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            <option value="">No specific system</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>What are your priorities?</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. I want more of the intimate, close-up detail I get from my current DAC. I prefer smaller stages but intense clarity. I'm not chasing big soundstaging."
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
