'use client';

/**
 * Audio XX — Context-aware back link.
 *
 * Most placeholder pages used to render `<Link href="/">&larr; Back</Link>`.
 * That works only when the user actually came from the home page; if they
 * arrived via a deep link, an in-app navigation chain, or a refresh, the
 * static "/" target silently drops them out of whatever flow they were in.
 *
 * This component prefers `router.back()` (browser history) and falls back
 * to a configurable href when there is no history entry to return to
 * (the very first page in the tab — `window.history.length === 1`).
 *
 * Visual contract: matches the existing back-link styling on the brand
 * page — small, muted, no underline-by-default. Caller can override via
 * `style` if they need a different alignment.
 */

import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

interface BackLinkProps {
  /** Fallback destination when there is no browser history to go back to. */
  fallbackHref?: string;
  /** Visible label. Defaults to "← Back". */
  label?: string;
  /** Optional inline style overrides for the anchor. */
  style?: CSSProperties;
}

export default function BackLink({
  fallbackHref = '/',
  label = '\u2190 Back',
  style,
}: BackLinkProps) {
  const router = useRouter();

  return (
    <a
      href={fallbackHref}
      onClick={(e) => {
        // Honor modifier-clicks (open in new tab, etc.) — let the browser handle them.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      style={{ cursor: 'pointer', ...style }}
    >
      {label}
    </a>
  );
}
