'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { parseTasteProfile, createEmptyProfile, type TasteProfile } from '@/lib/taste-profile';
import TasteRadar from './TasteRadar';

/* Active-state styling for top-nav links. Charcoal text + a subtle
 * 1px bottom border. Non-active links get a transparent border of the
 * same width to prevent layout shift when the active state changes.
 * No saffron / no warm accent — strictly neutral monochrome. */
const NAV_LINK_BASE: React.CSSProperties = {
  borderBottom: '1px solid transparent',
  paddingBottom: '2px',
};
const NAV_LINK_ACTIVE: React.CSSProperties = {
  color: '#2a2a2a',
  borderBottom: '1px solid #2a2a2a',
  paddingBottom: '2px',
};

export default function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname() ?? '';
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);

  // Active-route detection. Each tracked path matches itself plus any
  // nested segments (so /systems/123 still highlights "Systems").
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

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

  /* Build a NavLink-style anchor with active-state styling and
   * aria-current. Only used for the four routes the user listed:
   * /how-it-works, /glossary, /resources, /systems. The wordmark and
   * auth controls don't get active styling.
   *
   * D1 mobile QA (M1, 2026-05-18): items flagged with `secondary` get
   * a `nav-link-secondary` class. globals.css hides this class below
   * 480px to prevent the nav from overflowing into "ResourcesSign in"
   * at 360–414w. The primary entry ("How It Works") and the auth
   * affordances stay visible at every viewport. */
  function NavItem({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={secondary ? 'nav-link-secondary' : undefined}
        style={active ? NAV_LINK_ACTIVE : NAV_LINK_BASE}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </Link>
    );
  }

  return (
    <nav>
      <div className="nav-inner">
        {/* Primary group — wordmark + main nav links pulled to the
         *  left so navigation reads as a coherent header rather than a
         *  brand-on-left / chrome-on-right split. */}
        <div className="nav-primary">
          <Link href="/" className="brand">
            Audio<span className="brand-accent">&thinsp;XX</span>
          </Link>
          <div className="nav-links">
            <NavItem href="/how-it-works" label="How It Works" />
            <NavItem href="/glossary" label="Glossary" secondary />
            <NavItem href="/resources" label="Resources" secondary />
            {session && <NavItem href="/systems" label="Systems" />}
          </div>
        </div>

        {/* Secondary group — auth / status controls stay anchored to
         *  the far right. No active styling on these. */}
        <div className="nav-secondary">
          {session && (
            <>
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
