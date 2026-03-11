'use client';

import { SessionProvider } from 'next-auth/react';
import { AudioSessionProvider } from '@/lib/audio-session-context';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AudioSessionProvider>{children}</AudioSessionProvider>
    </SessionProvider>
  );
}
