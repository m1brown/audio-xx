/**
 * ONE PHYSICAL COMPONENT → ONE CANONICAL NODE.
 *
 * A saved system and the current message can describe the same box in
 * different words. "dCS Rossini Apex" typed today and `{brand: 'dCS', name:
 * 'Rossini Apex'}` saved last week are one amplifier stack in one room, and
 * the graph must contain it once.
 *
 * The defect this closes: the merge deduplicated on DISPLAY STRINGS. The saved
 * side registered "rossini apex" and "dcs"; the message side then asked
 * whether it had already seen "dcs rossini apex", which it had not. Two nodes,
 * same box — and production asked a listener "dCS Rossini Apex and dCS Rossini
 * Apex both appear as dacs. Are both active in the signal path?"
 *
 * String equality could not have caught that, and neither could role equality:
 * both nodes had the same role, which is why the duplicate-role validator was
 * the thing that noticed. Identity is the level the invariant belongs at.
 *
 * WHAT COUNTS AS THE SAME BOX
 *
 * Resolution through the catalog first, so two spellings of one product agree
 * on a product id. Failing that, a normalised token key: case, punctuation,
 * separators and a repeated brand prefix all removed, because none of them
 * distinguishes one physical unit from another.
 *
 * WHAT DOES NOT
 *
 * A variant suffix is never discarded. "CS600" and "CS600X" are different
 * products, and the catalog's own variant boundary is what keeps them apart —
 * collapsing them would be the mirror of this defect, merging two boxes that
 * are genuinely two.
 */
import { findProductByComponentName } from '../catalog/lookups';

/** Punctuation and separators that never distinguish two physical units. */
const NOISE = /[^\p{L}\p{N}]+/gu;

/**
 * The canonical identity of one physical component.
 *
 * Returns a catalog product key where the product resolves, and a normalised
 * token key otherwise — so uncatalogued gear still reconciles, which matters
 * because Nathan's chain is entirely uncatalogued.
 */
export function physicalIdentityKey(brand: string, name: string): string {
  const b = (brand ?? '').trim();
  const n = (name ?? '').trim();

  // A saved row may hold the full name in either field, or repeat the brand
  // inside the name ("dCS" + "dCS Rossini Apex"). Build the display form the
  // way every other surface does before resolving.
  const display = !b ? n
    : !n ? b
      : n.toLowerCase().startsWith(b.toLowerCase()) ? n
        : `${b} ${n}`;

  if (!display) return '';

  const product = findProductByComponentName(display);
  if (product) return `catalog:${product.brand.toLowerCase()}|${product.name.toLowerCase()}`;

  return `text:${normaliseIdentity(display)}`;
}

/**
 * Normalise a display string to a comparison key.
 *
 * Case, punctuation and separators go. Nothing else does — a version or
 * variant suffix is part of the identity, and dropping it would merge products
 * the catalog deliberately keeps distinct.
 */
export function normaliseIdentity(display: string): string {
  return (display ?? '').toLowerCase().replace(NOISE, ' ').trim().replace(/\s+/g, ' ');
}

/**
 * Do these two descriptions name the same physical component?
 *
 * Exposed for the reconciliation guard and for tests that need to state the
 * invariant directly rather than through a whole assessment.
 */
export function samePhysicalComponent(
  a: { brand?: string; name?: string },
  b: { brand?: string; name?: string },
): boolean {
  const ka = physicalIdentityKey(a.brand ?? '', a.name ?? '');
  const kb = physicalIdentityKey(b.brand ?? '', b.name ?? '');
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  /*
   * One side may be under-specified where the other is not: a saved row of
   * "Rossini Apex" against a typed "dCS Rossini Apex". Containment on the
   * TOKEN key resolves that without letting a bare brand swallow a product —
   * "dCS" alone must not match "dCS Rossini Apex", or a listener who names
   * only a brand would silently inherit a saved component's identity.
   */
  if (!ka.startsWith('text:') || !kb.startsWith('text:')) return false;
  const ta = ka.slice(5);
  const tb = kb.slice(5);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (shorter.split(' ').length < 2) return false;
  return longer === shorter || longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`);
}

/**
 * The identity keys the CURRENT MESSAGE resolves, which are authoritative.
 *
 * A saved system may supply context for components the listener has not
 * restated. It may never create a second node for one the message already
 * names — the message is the listener telling us what is in the room now.
 */
export function messageIdentityKeys(
  components: Array<{ brand?: string; name?: string; displayName?: string }>,
): Set<string> {
  const keys = new Set<string>();
  for (const c of components) {
    const key = c.displayName
      ? physicalIdentityKey('', c.displayName)
      : physicalIdentityKey(c.brand ?? '', c.name ?? '');
    if (key) keys.add(key);
  }
  return keys;
}

/** Is this saved component already named by the current message? */
export function alreadyNamedByMessage(
  saved: { brand?: string; name?: string },
  messageComponents: Array<{ brand?: string; name?: string; displayName?: string }>,
): boolean {
  return messageComponents.some((m) => samePhysicalComponent(saved, m.displayName
    ? { brand: '', name: m.displayName }
    : { brand: m.brand, name: m.name }));
}

/**
 * Does the current message already supply a component for this role slot?
 *
 * The mention guard alone is not enough. A listener who replaces one dCS with
 * another still writes "dCS", so the saved unit's BRAND appears in the message
 * and it was seeded alongside the replacement — two DACs, and a clarification
 * asking which is active, when the listener had just said.
 *
 * Precedence is the rule: where the message fills a slot, the message owns it.
 * A saved component in that slot is superseded, not added. Slots the message
 * leaves empty still take their saved context, so incremental and correction
 * workflows keep working.
 *
 * Two DACs the LISTENER named are both message components, so both survive —
 * this suppresses the saved one, never a stated one.
 */
export function messageSuppliesRole(
  messageComponents: Array<{
    category?: string; role?: string | null;
    brand?: string; name?: string; displayName?: string;
  }>,
  savedCategory: string | undefined,
  normalise: (label: string | undefined) => string | undefined,
): boolean {
  const slot = normalise(savedCategory);
  if (!slot) return false;
  return messageComponents.some((m) => {
    if (normalise(m.role ?? m.category) !== slot) return false;
    /*
     * Only a WELL-SPECIFIED filler takes the slot.
     *
     * A parse can leave a brand and lose the model — "dCS" where the listener
     * wrote "dCS Rossini Apex". Suppressing the saved component there would
     * trade a fully identified box for a bare brand, which is the opposite of
     * what precedence is for. When the message's filler is under-specified the
     * saved identity stands, and the existing collapse pass merges the two
     * mentions of the one box.
     */
    const display = [(m as { brand?: string }).brand, (m as { name?: string }).name]
      .filter(Boolean).join(' ').trim()
      || (m as { displayName?: string }).displayName || '';
    return normaliseIdentity(display).split(' ').filter(Boolean).length >= 2;
  });
}
