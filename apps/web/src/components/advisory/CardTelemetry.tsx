'use client';

/**
 * Audio XX — Product-card telemetry (client-only isolation).
 *
 * Server/client boundary fix: AdvisoryProductCard.tsx previously contained
 * a `useEffect` (for `trackCardView`) and multiple `onClick` handlers (for
 * `trackLinkClick`). Both are client-only APIs. That prevented server pages
 * (e.g. `/brand/[slug]`) from importing the card — Next.js threw
 * "You're importing a component that needs useEffect. This React Hook only
 * works in a Client Component."
 *
 * The smallest safe fix isolates the two client-only concerns here so that
 * the rest of the card is pure presentation and can render on the server.
 * Both exports are tiny — a no-render view beacon and an anchor wrapper —
 * and neither changes visual output or analytics semantics.
 *
 * Boundary note: these wrappers delegate to `interaction-tracker`. They do
 * NOT introduce new analytics events or change existing event shapes. If
 * `trackCardView`/`trackLinkClick` evolve, change them there; these stay
 * dumb passthroughs.
 */

import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  trackCardView,
  trackLinkClick,
} from '../../lib/interaction-tracker';
import { trackEvent } from '../../lib/track-event';

/**
 * B2 (GTM commerce conditions): measure every outbound commerce click by
 * destination type and monetization status. Monetized = URL carries an
 * affiliate parameter (tag= for Amazon Associates, campid= for eBay EPN);
 * with no affiliate env configured these are all false — the measurement
 * proves the commercial reality either way.
 *
 * Lives here, not in AdvisoryProductCard, for the reason in the module
 * docstring above. It was previously a local function there, passed down
 * as an `onClick` prop to `TrackedAnchor` — which re-introduced exactly the
 * boundary violation this module exists to prevent, because a function
 * cannot cross the server→client boundary. Every brand page 500'd as a
 * result. Keep client-only behaviour inside the client component.
 */
function trackOutboundCommerceClick(url: string): void {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const destType = /hifishark|audiogon|reverb/.test(host) ? 'used-marketplace-search'
      : /ebay\./.test(host) ? 'ebay-search'
      : /amazon\./.test(host) ? 'amazon'
      : (u.pathname === '/' || u.pathname === '') ? 'manufacturer-homepage'
      : 'manufacturer-page';
    const monetized = /[?&](tag|campid)=/.test(url);
    trackEvent('outbound_commerce_click', { destType, domain: host, monetized });
  } catch { /* never break navigation */ }
}

// ── Card view tracker ─────────────────────────────────
//
// Fires a single `card_view` event on mount. Renders nothing. Keep the
// effect dependency list identical to the previous inline useEffect so
// re-mount semantics don't change across this refactor.

export function CardViewTracker({
  product,
  role,
}: {
  product: string;
  role: string | undefined;
}) {
  useEffect(() => {
    trackCardView({ product, pickRole: role });
  }, [product, role]);
  return null;
}

// ── Tracked anchor ────────────────────────────────────
//
// Drop-in replacement for a raw `<a>` that additionally fires a
// `link_click` event. Every visual prop (href, target, rel, style) is
// passed through unchanged so the DOM output matches the prior raw-anchor
// markup byte-for-byte.
//
// `product` / `role` are the card-level context, identical to what the
// previous `handleLinkClick` closure captured. `kind` + `label` are the
// per-link fields. The Amazon-kind resolution that used to live in
// `ProductLinksSection.handleClick` is expected to happen at the call
// site (TrackedLinkRow) — passing the already-resolved kind here keeps
// this component a pure passthrough.

export function TrackedAnchor({
  href,
  target,
  rel,
  style,
  product,
  role,
  kind,
  label,
  children,
}: {
  href: string;
  target?: string;
  rel?: string;
  style?: CSSProperties;
  product: string;
  role: string | undefined;
  kind: string;
  /** Raw label to log (NOT the cleaned display label). */
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      style={style}
      onClick={() => {
        trackLinkClick({
          product,
          pickRole: role,
          linkKind: kind,
          linkLabel: label,
          linkUrl: href,
        });
        trackOutboundCommerceClick(href);
      }}
    >
      {children}
    </a>
  );
}
