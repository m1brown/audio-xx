/**
 * Audio XX — Lightweight Interaction Tracker (Step 10, Tasks 4–5)
 *
 * Session-level event logger for recommendation card interactions.
 * Stores events in memory with a ring buffer. No persistence layer,
 * no external analytics — just enough structure for future aggregation.
 *
 * Event types:
 *   - card_view:        product card rendered/visible
 *   - card_expand:      user expanded card details (future)
 *   - link_click:       user clicked any link in a card
 *   - preference_signal: user sent a preference refinement
 *
 * Link kinds (on link_click events):
 *   - buy_new:          new purchase link (manufacturer, dealer)
 *   - buy_used:         used market link (HiFi Shark, eBay, Audiogon)
 *   - further_reading:  review or reference link
 */

// ── Event Types ──────────────────────────────────────

export type InteractionEventType =
  | 'card_view'
  | 'card_expand'
  | 'link_click'
  | 'preference_signal';

export interface InteractionEvent {
  /** Event type. */
  type: InteractionEventType;
  /** ISO timestamp. */
  timestamp: string;
  /** Product brand + name (e.g. "Naim Nait XS 3"). */
  product?: string;
  /** Product category (amplifier, dac, speaker, etc.). */
  category?: string;
  /** Role tag (top_pick, upgrade_pick, value_pick). */
  pickRole?: string;
  /** Link kind (buy_new, buy_used, further_reading). */
  linkKind?: string;
  /** Link label (human-readable). */
  linkLabel?: string;
  /** Link URL. */
  linkUrl?: string;
  /** Freeform metadata. */
  meta?: Record<string, unknown>;
}

// ── Ring Buffer ──────────────────────────────────────

const MAX_EVENTS = 200;
const events: InteractionEvent[] = [];

function pushEvent(event: InteractionEvent): void {
  if (events.length >= MAX_EVENTS) {
    events.shift();
  }
  events.push(event);

  // Console log for dev observability
  if (typeof console !== 'undefined') {
    console.log(
      '[interaction] %s product=%s kind=%s label=%s',
      event.type,
      event.product ?? '-',
      event.linkKind ?? '-',
      event.linkLabel ?? '-',
    );
  }
}

// ── Public API ───────────────────────────────────────

/**
 * Track a link click from a recommendation card.
 */
export function trackLinkClick(opts: {
  product: string;
  category?: string;
  pickRole?: string;
  linkKind: string;
  linkLabel: string;
  linkUrl: string;
}): void {
  pushEvent({
    type: 'link_click',
    timestamp: new Date().toISOString(),
    product: opts.product,
    category: opts.category,
    pickRole: opts.pickRole,
    linkKind: opts.linkKind,
    linkLabel: opts.linkLabel,
    linkUrl: opts.linkUrl,
  });
}

/**
 * Track when a product card becomes visible to the user.
 */
export function trackCardView(opts: {
  product: string;
  category?: string;
  pickRole?: string;
}): void {
  pushEvent({
    type: 'card_view',
    timestamp: new Date().toISOString(),
    product: opts.product,
    category: opts.category,
    pickRole: opts.pickRole,
  });
}

/**
 * Track a preference refinement signal from the user.
 */
export function trackPreferenceSignal(opts: {
  signal: string;
  category?: string;
  meta?: Record<string, unknown>;
}): void {
  pushEvent({
    type: 'preference_signal',
    timestamp: new Date().toISOString(),
    meta: { signal: opts.signal, category: opts.category, ...opts.meta },
  });
}

// ── Accessors (for debugging / future export) ────────

/**
 * Get all tracked events (most recent last).
 */
export function getInteractionEvents(): readonly InteractionEvent[] {
  return events;
}

/**
 * Get a summary of interaction counts by type and link kind.
 */
export function getInteractionSummary(): {
  total: number;
  byType: Record<string, number>;
  byLinkKind: Record<string, number>;
  topProducts: Array<{ product: string; clicks: number }>;
} {
  const byType: Record<string, number> = {};
  const byLinkKind: Record<string, number> = {};
  const productClicks: Record<string, number> = {};

  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    if (e.linkKind) {
      byLinkKind[e.linkKind] = (byLinkKind[e.linkKind] ?? 0) + 1;
    }
    if (e.type === 'link_click' && e.product) {
      productClicks[e.product] = (productClicks[e.product] ?? 0) + 1;
    }
  }

  const topProducts = Object.entries(productClicks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([product, clicks]) => ({ product, clicks }));

  return { total: events.length, byType, byLinkKind, topProducts };
}

/**
 * Clear all tracked events (for testing).
 */
export function clearInteractionEvents(): void {
  events.length = 0;
}
