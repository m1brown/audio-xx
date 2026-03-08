'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Nav() {
  const { data: session } = useSession();

  return (
    <nav>
      <div className="nav-inner">
        <Link href="/" className="brand">Audio XX</Link>
        <div className="nav-links">
          <Link href="/">Home</Link>
          {session && (
            <>
              <Link href="/systems">Systems</Link>
              <Link href="/profile">Profile</Link>
              <button onClick={() => signOut()} className="btn btn-sm">Sign out</button>
            </>
          )}
          {!session && <Link href="/auth/signin">Sign in</Link>}
        </div>
      </div>
    </nav>
  );
}
