import { Suspense } from 'react';
import CandidatePageClient from './CandidatePageClient';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <CandidatePageClient />
    </Suspense>
  );
}