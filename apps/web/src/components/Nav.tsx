'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { parseTasteProfile, createEmptyProfile, type TasteProfile } from '@/lib/taste-profile';
import TasteRadar from './TasteRadar';

export default function Nav() {
  const { data: session } = useSession();
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);

  useEffect(() => {
    if (!session) {
      setTasteProfile(null);
      return;
    }
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preferredTraits) {
          setTasteProfile(parseTasteProfile(data.preferredTraits));
        } else {
          setTasteProfile(createEmptyProfile());
        }
      })
      .catch(() => setTasteProfile(createEmptyProfile()));
  }, [session]);

  return (
    <nav>
      <div className="nav-inner">
        <Link href="/" className="brand">
          Audio<span className="brand-accent">&thinsp;XX</span>
        </Link>
        <div className="nav-links">
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/resources">Resources</Link>
          {session && (
            <>
              <Link href="/systems">Systems</Link>
              <Link href="/profile" className="nav-radar-link" title="Your taste profile">
                {tasteProfile ? (
                  <TasteRadar profile={tasteProfile} miniature size={28} />
                ) : (
                  <span style={{ width: 28, height: 28, display: 'inline-block' }} />
                )}
              </Link>
              <button onClick={() => signOut()} className="btn btn-sm">Sign out</button>
            </>
          )}
          {!session && <Link href="/auth/signin">Sign in</Link>}
        </div>
      </div>
    </nav>
  );
}
