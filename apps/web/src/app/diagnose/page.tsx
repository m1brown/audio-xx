import { Suspense } from 'react';
import { connection } from 'next/server';
import DiagnosePageClient from './DiagnosePageClient';

export default async function Page() {
  await connection();
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <DiagnosePageClient />
    </Suspense>
  );
}
