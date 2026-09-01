'use client';

/**
 * Audio XX product analytics (MVP M5) — the canonical event layer.
 *
 * ONE shared function routes every product event; the vendor (currently
 * Vercel Analytics) is an implementation detail behind it and can be
 * swapped without touching product code. Baseline pageviews/performance
 * come from the <Analytics /> component in the root layout.
 *
 * Privacy rules (enforced here, not by convention):
 *  - Only events named in EVENTS are ever sent.
 *  - Only allowlisted, primitive property keys are ever sent.
 *  - No system names, notes, free-text, URLs, emails, or payment data
 *    can pass through — unknown keys and long strings are dropped.
 *  - No user identifiers are attached client-side; Vercel Analytics is
 *    cookie-less and anonymous.
 *  - Hydration/strict-mode double-fires are deduped per page load for
 *    view-type events.
 *
 * The full specification lives in docs/analytics-events.md and must be
 * updated together with this file.
 */
import { track as vercelTrack } from '@vercel/analytics';

export const EVENTS = [
  'landing_viewed',
  'builder_started',
  // Pre-beta item 5 (2026-07-31): the three funnel gaps — first
  // meaningful component, unified submit, and auth entry. Payload-free
  // apart from allowlisted enum props; never user text.
  'builder_first_component',
  'assessment_submitted',
  'auth_initiated',
  'composer_started',
  'assessment_rendered',
  'assessment_failed',
  'copy_link_clicked',
  'print_clicked',
  'save_started',
  'account_created',
  'sign_in_completed',
  'first_system_saved',
  'additional_system_saved',
  'assessment_added',
  'identical_assessment_declined',
  'my_systems_viewed',
  'subscription_prompt_viewed',
  'checkout_started',
  'checkout_cancelled',
  'subscription_activated',
  'subscription_cancelled',
  'trial_action_blocked',
] as const;

export type ProductEvent = (typeof EVENTS)[number];

/** Allowlisted property keys — enums/booleans/small numbers only. */
const ALLOWED_PROPS = new Set([
  'source',        // 'builder' | 'composer' | 'direct'
  'signed_in',     // boolean
  'state',         // entitlement state enum
  'first',         // boolean (first vs repeat save)
  'action',        // protected action enum ('save' | 'add' | 'rename' | 'notes')
  'days_left',     // number
  'outcome',       // small enum
]);

const MAX_STRING = 24;

export function sanitizeProps(
  props?: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(key)) continue;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      out[key] = value;
    } else if (typeof value === 'string' && value.length <= MAX_STRING) {
      out[key] = value;
    }
  }
  return out;
}

/** Events that describe a view and must fire once per page load. */
const ONCE_PER_LOAD: ReadonlySet<string> = new Set([
  'landing_viewed', 'assessment_rendered', 'my_systems_viewed',
  'subscription_prompt_viewed', 'builder_started', 'composer_started',
]);
const fired = new Set<string>();

/**
 * Vendor quirk guard: @vercel/analytics' track() drops events silently
 * when window.va does not exist yet, and page-component mount effects
 * run BEFORE the root layout's <Analytics /> installs it. Installing
 * the identical queue stub early means mount-time events (the top of
 * the funnel) are queued and flushed instead of lost.
 */
function ensureQueue(): void {
  const w = window as unknown as { va?: (...params: unknown[]) => void; vaq?: unknown[] };
  if (w.va) return;
  w.va = function (...params: unknown[]) {
    if (!w.vaq) w.vaq = [];
    w.vaq.push(params);
  };
}

export function track(event: ProductEvent, props?: Record<string, unknown>): void {
  if (!EVENTS.includes(event)) return;
  if (ONCE_PER_LOAD.has(event)) {
    if (fired.has(event)) return;
    fired.add(event);
  }
  try {
    if (typeof window !== 'undefined') ensureQueue();
    vercelTrack(event, sanitizeProps(props));
  } catch { /* analytics must never break the product */ }
}

/** Test hook: reset the per-load dedupe (page navigations create a new module scope in practice). */
export function __resetForTests(): void {
  fired.clear();
}
