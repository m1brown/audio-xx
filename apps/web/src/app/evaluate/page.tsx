import { Suspense } from 'react';
import { connection } from 'next/server';
import EvaluatePageClient from './EvaluatePageClient';

export default async function Page() {
  await connection();
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EvaluatePageClient />
    </Suspense>
  );
}