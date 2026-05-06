'use client';

import { SessionProvider } from 'next-auth/react';
import { AudioSessionProvider } from '@/lib/audio-session-context';
import type { ReactNode } from 'react';

// ── Production debug-log silencer ─────────────────────────
// The codebase uses tagged `console.log('[tag] ...')` patterns liberally
// for development tracing (turn-debug, intent-authority, decisive-debug,
// etc.). These are valuable in dev and noise/PII risk in production.
//
// Strategy: hijack `console.log` once on the client and drop any call
// whose first argument is a string starting with '['. Untagged logs and
// all `console.warn` / `console.error` traffic pass through unchanged so
// real errors still surface.
//
// Toggle with NEXT_PUBLIC_DEBUG=1 to keep tagged logs visible — useful
// when debugging production behavior. Server-side logs (Vercel function
// logs) are unaffected; this override is browser-only.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG !== '1') {
  const originalLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith('[')) {
      return; // tagged debug log — drop in production
    }
    originalLog(...args);
  };
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AudioSessionProvider>{children}</AudioSessionProvider>
    </SessionProvider>
  );
}
