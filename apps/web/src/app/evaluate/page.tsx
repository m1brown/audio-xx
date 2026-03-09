import { Suspense } from 'react';
import EvaluatePageClient from './EvaluatePageClient';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EvaluatePageClient />
    </Suspense>
  );
}