'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewSystem() {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, notes }),
    });
    if (res.ok) {
      const sys = await res.json();
      router.push(`/systems/${sys.id}`);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>New system</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Living Room Setup" required />
        </div>
        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context about this system..." />
        </div>
        <button type="submit" className="btn btn-primary">Create</button>
      </form>
    </div>
  );
}
