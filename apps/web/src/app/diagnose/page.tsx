import { Suspense } from 'react';
import DiagnosePageClient from './DiagnosePageClient';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <DiagnosePageClient />
    </Suspense>
  );
}
