'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface System {
  id: string;
  name: string;
  notes: string | null;
  updatedAt: string;
  components: Array<{ component: { name: string; brand: string; category: string } }>;
}

export default function SystemsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [systems, setSystems] = useState<System[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  if (status !== 'authenticated') return null;

  return (
    <div>
      <div className="flex-between mb-2">
        <h1>Systems</h1>
        <Link href="/systems/new" className="btn btn-primary btn-sm">New system</Link>
      </div>

      {systems.length === 0 ? (
        <p className="muted">No systems yet. Create one to get started.</p>
      ) : (
        systems.map((sys) => (
          <div key={sys.id} className="item-row">
            <div className="flex-between">
              <Link href={`/systems/${sys.id}`}>{sys.name}</Link>
              <span className="small muted">{new Date(sys.updatedAt).toLocaleDateString()}</span>
            </div>
            {sys.notes && <p className="small muted">{sys.notes}</p>}
            {sys.components.length > 0 && (
              <p className="small muted mt-1">
                {sys.components.map((sc) => `${sc.component.brand} ${sc.component.name}`).join(' · ')}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
