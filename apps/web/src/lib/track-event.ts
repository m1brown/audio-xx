/**
 * Client-side validation telemetry (Workstream 25B).
 *
 * Fire-and-forget event helper + lightweight visit/return detection for
 * the first 50-user cohort. Posts to /api/events, which logs each event
 * as an `[AXX-EVENT]` line. No third-party analytics, no PII.
 *
 * Return detection uses localStorage only:
 *   - axx_first_seen      — timestamp of the first ever visit
 *   - axx_last_decision   — timestamp of the last decision_intent fired
 *
 * A "return visit with a new decision" = a session that is NOT the first
 * visit AND in which the user submits a decision, given a decision was
 * recorded in a prior session.
 */

const VISIT_KEY = 'axx_first_seen';
const LAST_DECISION_KEY = 'axx_last_decision';

let isReturnSession = false;
let priorDecisionExisted = false;
let returnDecisionFired = false;

const hasWindow = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/** Fire-and-forget a single validation event. Never throws. */
export function trackEvent(
  event: string,
  props?: Record<string, unknown>,
): void {
  if (typeof fetch === 'undefined') return;
  try {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, props: props ?? {}, ts: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry must never break a session */
  }
}

/**
 * Call once on app mount (client). Emits `return_visit` when this is not
 * the user's first visit, and records the first-visit timestamp otherwise.
 */
export function initSessionTelemetry(): void {
  if (!hasWindow()) return;
  try {
    const firstSeen = window.localStorage.getItem(VISIT_KEY);
    priorDecisionExisted = !!window.localStorage.getItem(LAST_DECISION_KEY);
    if (firstSeen) {
      isReturnSession = true;
      trackEvent('return_visit', { firstSeen: Number(firstSeen) });
    } else {
      window.localStorage.setItem(VISIT_KEY, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Record a decision-intent entry. Also emits `return_visit_new_decision`
 * (once per session) when the user is returning and had made a decision
 * in a previous session.
 */
export function trackDecisionIntent(props?: Record<string, unknown>): void {
  trackEvent('decision_intent_entry', props);
  if (isReturnSession && priorDecisionExisted && !returnDecisionFired) {
    trackEvent('return_visit_new_decision', props);
    returnDecisionFired = true;
  }
  if (hasWindow()) {
    try {
      window.localStorage.setItem(LAST_DECISION_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
}
