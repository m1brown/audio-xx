'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Component {
  id: string;
  name: string;
  brand: string;
  category: string;
  confidenceLevel: string;
  isReference: boolean;
}

interface SystemComponent {
  id: string;
  componentId: string;
  roleOverride: string | null;
  notes: string | null;
  addedAt: string;
  actionLog: string;
  component: Component;
}

interface Snapshot {
  id: string;
  inputText: string;
  createdAt: string;
}

interface SystemData {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  components: SystemComponent[];
  snapshots: Snapshot[];
}

export default function SystemDetail() {
  const params = useParams();
  const router = useRouter();
  const [system, setSystem] = useState<SystemData | null>(null);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [catalogComponents, setCatalogComponents] = useState<Component[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ name: '', brand: '', category: 'speakers' });

  useEffect(() => { loadSystem(); }, [params.id]);

  async function loadSystem() {
    const res = await fetch(`/api/systems/${params.id}`);
    if (res.ok) setSystem(await res.json());
    else router.push('/systems');
  }

  async function searchCatalog(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setCatalogComponents([]); return; }
    const res = await fetch(`/api/components?q=${encodeURIComponent(q)}`);
    if (res.ok) setCatalogComponents(await res.json());
  }

  async function addFromCatalog(componentId: string) {
    await fetch(`/api/systems/${params.id}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentId }),
    });
    setShowAddComponent(false);
    setSearchQuery('');
    loadSystem();
  }

  async function addManual() {
    const compRes = await fetch('/api/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manual),
    });
    if (!compRes.ok) return;
    const comp = await compRes.json();
    await fetch(`/api/systems/${params.id}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentId: comp.id }),
    });
    setShowAddComponent(false);
    setManualMode(false);
    setManual({ name: '', brand: '', category: 'speakers' });
    loadSystem();
  }

  async function removeComponent(systemComponentId: string) {
    await fetch(`/api/systems/${params.id}/components`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemComponentId }),
    });
    loadSystem();
  }

  if (!system) return <p className="muted">Loading...</p>;

  const categories = ['speakers', 'amplifier', 'dac', 'streamer', 'turntable', 'cartridge', 'phono_stage', 'cables'];

  return (
    <div>
      <h1>{system.name}</h1>
      {system.notes && <p className="small muted">{system.notes}</p>}
      <p className="small muted mb-1">
        Created {new Date(system.createdAt).toLocaleDateString()} · Updated {new Date(system.updatedAt).toLocaleDateString()}
      </p>

      <div className="flex gap-sm mb-2">
        <Link href={`/evaluate?systemId=${system.id}`} className="btn btn-sm">Evaluate</Link>
        <Link href={`/evaluate/candidate?systemId=${system.id}`} className="btn btn-sm">Evaluate candidate</Link>
        <Link href={`/diagnose?systemId=${system.id}`} className="btn btn-sm">Diagnose</Link>
      </div>

      <hr />

      <h2>Components</h2>
      {system.components.length === 0 ? (
        <p className="muted small">No components yet.</p>
      ) : (
        system.components.map((sc) => (
          <div key={sc.id} className="item-row">
            <div className="flex-between">
              <div>
                <span className="small muted">{sc.component.category.replace(/_/g, ' ')}</span>
                {sc.component.isReference && <span className="small muted"> · reference</span>}
                <br />
                <strong>{sc.component.brand} {sc.component.name}</strong>
                {sc.roleOverride && <span className="small muted"> ({sc.roleOverride})</span>}
              </div>
              <button onClick={() => removeComponent(sc.id)} className="btn btn-danger btn-sm">Remove</button>
            </div>
            {sc.notes && <p className="small muted">{sc.notes}</p>}
            <details>
              <summary>Change history</summary>
              <div className="small mt-1">
                {JSON.parse(sc.actionLog).map((entry: { action: string; timestamp: string }, i: number) => (
                  <p key={i}>{entry.action} — {new Date(entry.timestamp).toLocaleString()}</p>
                ))}
              </div>
            </details>
          </div>
        ))
      )}

      <div className="mt-1 mb-2">
        <button onClick={() => setShowAddComponent(!showAddComponent)} className="btn btn-sm">
          {showAddComponent ? 'Cancel' : '+ Add component'}
        </button>
      </div>

      {showAddComponent && (
        <div className="section">
          <div className="flex-between mb-1">
            <h3>{manualMode ? 'Add manually' : 'Search catalog'}</h3>
            <button onClick={() => setManualMode(!manualMode)} className="btn btn-sm">
              {manualMode ? 'Search catalog' : 'Add manually'}
            </button>
          </div>

          {manualMode ? (
            <div>
              <div className="field">
                <label>Brand</label>
                <input value={manual.brand} onChange={(e) => setManual({ ...manual, brand: e.target.value })} />
              </div>
              <div className="field">
                <label>Name</label>
                <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })}>
                  {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <button onClick={addManual} className="btn btn-primary btn-sm">Add</button>
            </div>
          ) : (
            <div>
              <div className="field">
                <input placeholder="Search by name or brand..." value={searchQuery} onChange={(e) => searchCatalog(e.target.value)} />
              </div>
              {catalogComponents.map((c) => (
                <div key={c.id} className="item-row flex-between">
                  <span className="small">
                    {c.brand} {c.name}
                    <span className="muted"> · {c.category.replace(/_/g, ' ')}</span>
                    {c.isReference && <span className="muted"> · reference</span>}
                  </span>
                  <button onClick={() => addFromCatalog(c.id)} className="btn btn-sm">Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {system.snapshots.length > 0 && (
        <>
          <hr />
          <h2>Recent evaluations</h2>
          {system.snapshots.map((snap) => (
            <div key={snap.id} className="item-row">
              <p className="small">{snap.inputText.substring(0, 200)}{snap.inputText.length > 200 ? '...' : ''}</p>
              <p className="small muted">{new Date(snap.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
