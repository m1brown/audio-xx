'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import EvaluationOutput from '@/components/EvaluationOutput';

interface System { id: string; name: string; }

interface DiagnosisRule {
  rule_id: string;
  label: string;
  likely_cause: string;
  suggestions: string[];
  risks: string[];
  next_step: string;
  archetype_note?: string;
}

interface DiagnosisResult {
  interpretation: {
    matched_phrases: string[];
    symptoms: string[];
    traits: Record<string, string>;
    archetype_hints: string[];
    uncertainty_level: number;
  };
  diagnosis: DiagnosisRule[];
  archetype_conflict: boolean;
  note: string;
}

export default function DiagnosePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [systems, setSystems] = useState<System[]>([]);
  const [systemId, setSystemId] = useState(searchParams.get('systemId') || '');
  const [symptoms, setSymptoms] = useState('');
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  async function handleDiagnose(e: React.FormEvent) {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemId: systemId || undefined, symptoms }),
    });
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  if (status !== 'authenticated') return null;

  return (
    <div>
      <h1>Diagnose</h1>
      <p className="small muted mb-2">
        Describe what is wrong. The system will propose likely causes and reversible next steps.
      </p>

      <form onSubmit={handleDiagnose}>
        <div className="field">
          <label>System (optional)</label>
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            <option value="">No specific system</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>What are you experiencing?</label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. After switching DACs, the system sounds harsh and fatiguing. I lost the warmth I had before."
            style={{ minHeight: 140 }}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Diagnosing...' : 'Diagnose'}
        </button>
      </form>

      {result && (
        <div className="mt-2">
          <hr />
          <EvaluationOutput
            signals={{
              traits: result.interpretation.traits,
              symptoms: result.interpretation.symptoms,
              archetype_hints: result.interpretation.archetype_hints,
              uncertainty_level: result.interpretation.uncertainty_level,
              matched_phrases: result.interpretation.matched_phrases,
            }}
            result={{
              fired_rules: result.diagnosis.map((d) => ({
                id: d.rule_id,
                label: d.label,
                priority: 0,
                outputs: {
                  explanation: d.likely_cause,
                  suggestions: d.suggestions,
                  risks: d.risks,
                  next_step: d.next_step,
                  archetype_note: d.archetype_note,
                },
              })),
              archetype_conflict_detected: result.archetype_conflict,
              uncertainty_level: result.interpretation.uncertainty_level,
            }}
          />
          <p className="small muted" style={{ fontStyle: 'italic' }}>{result.note}</p>
        </div>
      )}
    </div>
  );
}
