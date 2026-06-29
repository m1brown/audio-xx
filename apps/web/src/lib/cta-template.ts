/**
 * CTA template helpers — pure functions for the homepage Assess CTA.
 *
 * Extracted from page.tsx so the slot-mapping and cursor-placement
 * logic can be unit-tested in isolation. The page calls these from
 * the Assess door's onClick to either:
 *   - autofill the composer with a saved active system's components
 *     mapped to the four labelled slots, or
 *   - present the generic empty scaffold when no active system exists.
 */

import type { ProductCategory } from './catalog-taxonomy';
import type { SystemComponentRole } from './system-types';

export type AssessSlot = 'Speakers' | 'Amplifier' | 'DAC / Streamer' | 'Source';

export const ASSESS_SLOTS: readonly AssessSlot[] = [
  'Speakers',
  'Amplifier',
  'DAC / Streamer',
  'Source',
] as const;

/**
 * Map a saved-system component to one of the four CTA template slots.
 * Returns null for component categories that don't fit the four-slot
 * shape (cables, headphones, IEMs, accessories). Phono-stage role is
 * routed to Source so it sits next to the turntable it serves.
 */
export function slotForComponent(c: {
  category?: ProductCategory | null;
  role?: SystemComponentRole;
}): AssessSlot | null {
  if (c.role === 'phono_stage') return 'Source';
  switch (c.category) {
    case 'speaker': return 'Speakers';
    case 'amplifier': return 'Amplifier';
    case 'integrated': return 'Amplifier';
    case 'dac': return 'DAC / Streamer';
    case 'streamer': return 'DAC / Streamer';
    case 'turntable': return 'Source';
    case 'phono': return 'Source';
    default: return null;
  }
}

/**
 * Brand + name resolver matching the right-rail formatter — keeps the
 * autofilled composer labels identical to what the visitor sees in the
 * SYSTEM rail.
 */
export function formatComponentLabel(c: { brand?: string | null; name?: string | null }): string {
  const b = (c.brand || '').trim();
  const n = (c.name || '').trim();
  if (b && !n.toLowerCase().startsWith(b.toLowerCase())) return `${b} ${n}`.trim();
  return n || b || 'Unknown';
}

/**
 * Pre-fill the assessment scaffold with the saved active-system's
 * components. Multiple components for the same slot are comma-joined.
 * Cursor lands at end of the first empty slot's label (with trailing
 * space inserted) so the visitor either confirms-and-sends or adds
 * what's missing. If all four slots are filled, cursor goes to end of
 * text.
 */
export function populateAssessTemplate(
  components: Array<{
    brand?: string | null;
    name?: string | null;
    category?: ProductCategory | null;
    role?: SystemComponentRole;
  }>,
): { text: string; cursor: number } {
  const slots: Record<AssessSlot, string[]> = {
    'Speakers': [],
    'Amplifier': [],
    'DAC / Streamer': [],
    'Source': [],
  };
  for (const c of components) {
    const slot = slotForComponent(c);
    if (slot) slots[slot].push(formatComponentLabel(c));
  }
  const firstEmpty = ASSESS_SLOTS.find((s) => slots[s].length === 0) ?? null;
  const lines: string[] = ['Assess my system', ''];
  for (const slot of ASSESS_SLOTS) {
    const vals = slots[slot];
    if (vals.length > 0) {
      lines.push(`${slot}: ${vals.join(', ')}`);
    } else if (slot === firstEmpty) {
      lines.push(`${slot}: `);
    } else {
      lines.push(`${slot}:`);
    }
  }
  const text = lines.join('\n');
  const cursor = firstEmpty
    ? text.indexOf(`${firstEmpty}: `) + `${firstEmpty}: `.length
    : text.length;
  return { text, cursor };
}
