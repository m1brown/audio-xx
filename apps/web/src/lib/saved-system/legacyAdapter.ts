/**
 * Saved-system → legacy advisory adapter.
 *
 * Step 2 of the advisory-bridge sequence.
 *
 * Converts a new SavedSystemProfile (client-local, slot+free-text shape)
 * into the existing legacy ActiveSystemContext that advisory builders
 * already consume via `system-bridge.ts` / `system-interaction.ts`.
 *
 * This adapter is deterministic and pure. It is NOT wired into advisory
 * yet — Step 3 will do that. Nothing in this file imports or mutates
 * advisory state; it only produces a value.
 *
 * Lossy by design:
 *   - Only components with status === 'current' are included. 'evaluating',
 *     'parked', and 'sold' rows are not part of the user's current chain
 *     and must not influence chain-interaction analysis.
 *   - `brand` is always emitted as '' for free-text rows. The adapter
 *     does not parse brand out of free text; brand-aware reasoning is
 *     deferred until productId matching exists.
 *   - `productId` rows are passed through as `name` without a catalog
 *     lookup (the adapter stays pure and catalog-agnostic). Real product
 *     resolution is deferred to a later step.
 *   - `tendencies` is left null here; the legacy `inferTendenciesFromComponents`
 *     can be run on the adapted component list by the caller if needed.
 *   - `primaryUse` is derived from SavedSystemRole only where the mapping
 *     is unambiguous (headphone → 'headphones'). Everything else is null.
 */

import type {
  ProductCategory,
  // ProductSubcategory is not needed here
} from '../catalog-taxonomy';
import type {
  ActiveSystemContext,
  SystemComponentRole,
} from '../system-types';
import type {
  SavedSystemComponentRow,
  SavedSystemProfile,
  SavedSystemRole,
  SavedSystemSlot,
} from './types';

// ── Slot mapping ────────────────────────────────────────
//
// Each new SavedSystemSlot maps to exactly one legacy ProductCategory
// plus an optional SystemComponentRole for amplifier-family slots.
// Keep this table the single source of truth; both mappers read from it.

interface SlotMapping {
  category: ProductCategory;
  role: SystemComponentRole;
}

const SLOT_TABLE: Readonly<Record<SavedSystemSlot, SlotMapping>> = {
  source:     { category: 'streamer',   role: null },
  dac:        { category: 'dac',        role: null },
  pre:        { category: 'amplifier',  role: 'preamp' },
  power:      { category: 'amplifier',  role: 'power_amp' },
  integrated: { category: 'integrated', role: null },
  speaker:    { category: 'speaker',    role: null },
  headphone:  { category: 'headphone',  role: null },
  cartridge:  { category: 'cartridge',  role: null },
  cable:      { category: 'cable',      role: null },
};

// ── Role mapping ────────────────────────────────────────

function primaryUseFromRole(role: SavedSystemRole): string | null {
  // Only the unambiguous case is emitted. The legacy `primaryUse` field
  // is free-form text; keeping it minimal avoids polluting advisory reasoning.
  if (role === 'headphone') return 'headphones';
  return null;
}

// ── Component mapping ──────────────────────────────────

function componentName(row: SavedSystemComponentRow): string {
  // Precedence: free-text (user-authored) wins when both are present.
  // productId is passed through verbatim; catalog resolution is deferred.
  if (row.freeText && row.freeText.trim().length > 0) return row.freeText.trim();
  if (row.productId) return row.productId;
  return '(unspecified)';
}

function adaptRow(row: SavedSystemComponentRow): ActiveSystemContext['components'][number] {
  const mapping = SLOT_TABLE[row.slot];
  return {
    name: componentName(row),
    brand: '', // unknown without catalog / brand parsing
    category: mapping.category,
    role: mapping.role,
  };
}

// ── Public adapter ──────────────────────────────────────

/**
 * Convert a SavedSystemProfile into the legacy ActiveSystemContext shape.
 *
 * Only components with status === 'current' are emitted. All other statuses
 * are excluded from the chain sent to advisory.
 *
 * Returns a complete ActiveSystemContext even when the resulting component
 * list is empty — the caller decides whether to treat an empty chain as
 * "ask for components" or "evaluate with what we have". Step 3 will encode
 * that policy.
 */
// ── Synthetic free-text rendering ───────────────────────
//
// Rendering the adapted context as a single text block lets us inject
// the user's saved system into the existing text-driven conversation
// pipeline without changing any downstream extraction code. Step 3 uses
// this so the conversation state machine can satisfy `hasComponentDescription`
// from a saved system in exactly the same way it does from a typed message.

const SLOT_LABEL: Readonly<Record<SavedSystemSlot, string>> = {
  source: 'Source',
  dac: 'DAC',
  pre: 'Preamp',
  power: 'Power amp',
  integrated: 'Integrated amp',
  speaker: 'Speakers',
  headphone: 'Headphones',
  cartridge: 'Cartridge',
  cable: 'Cable',
};

/**
 * Build a deterministic free-text rendering of a saved system suitable
 * for injection into the existing text-driven conversation pipeline.
 *
 * Only `status === 'current'` rows are emitted. Returns an empty string
 * if the system has no current components.
 */
export function buildSyntheticSystemText(profile: SavedSystemProfile): string {
  const rows = profile.components.filter((c) => c.status === 'current');
  if (rows.length === 0) return '';
  // Emit plain, comma-separated component names without role labels.
  // Role labels (e.g. "DAC:", "Speakers:") were previously mis-parsed by
  // validateSystemComponents → detectUserAppliedRole, which interpreted
  // the label as a user-asserted role for the neighbouring component and
  // emitted false role-label-conflict clarifications (e.g. "You described
  // the WLM Diva Monitor as a DAC"). Saved-system slots are already
  // authoritative; the text only needs to carry the component names so
  // extractSubjectMatches can find them by name.
  const names = rows.map((row) => componentName(row));
  return `My system: ${names.join(', ')}.`;
}

export function savedSystemToLegacyContext(
  profile: SavedSystemProfile,
): ActiveSystemContext {
  const currentRows = profile.components.filter((c) => c.status === 'current');
  return {
    name: profile.label,
    components: currentRows.map(adaptRow),
    tendencies: null,
    location: profile.room?.notes ?? null,
    primaryUse: primaryUseFromRole(profile.role),
  };
}
