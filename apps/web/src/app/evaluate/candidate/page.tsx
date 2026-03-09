import { Suspense } from 'react';
import { connection } from 'next/server';
import CandidatePageClient from './CandidatePageClient';

export default async function Page() {
  await connection();
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <CandidatePageClient />
    </Suspense>
  );
}