/**
 * System components as they reach the screen.
 *
 * GOVERNING INVARIANT (founder, 2026-08-16):
 *
 *   A system is a collection of component identities. No downstream surface
 *   may collapse those identities into a synthetic product.
 *
 * The violation this exists to end: `llm-system-inference.ts` set
 * `subject: componentNames.join(', ')`, and every downstream surface treats a
 * subject as ONE product. Image lookup, HiFiShark, eBay and the Subject Card
 * all received the string
 *
 *   "dCS Rossini Apex + ARC ref 5 + Butler Monads + Acora QRC-2"
 *
 * — a product that does not exist. No image could match it, so the whole
 * system fell back to a generic placeholder even though the dCS may well have
 * an approved image; and the commerce links searched a marketplace for a
 * four-headed product.
 *
 * This is a PROJECTION of the authoritative graph, not a second component
 * model. It carries only what the screen needs — identity, role, evidence
 * basis, and the per-component links — and each field is resolved
 * independently so that failure degrades per component. A missing Acora image
 * must never suppress the dCS image.
 *
 * Nothing here decides authority. `basis` arrives already computed by
 * `computeComponentProvenance` from what Audio XX actually holds; this module
 * may not promote a component to make the display tidier.
 */

import { getProductImage } from './product-images';
import { buildProductLinks } from './product-links';

export type EvidenceBasis = 'catalog' | 'brand' | 'model' | 'user';

/** One component, as presented. */
export interface SystemComponentView {
  /** Identity shown to the reader — canonical when corroborated, else the listener's words. */
  displayName: string;
  /** Exactly as the listener wrote it. Never overwritten. */
  listenerName: string;
  /** Functional role from the explicit label or the catalog. */
  role: string;
  /** Reader-facing role, stating both jobs for a multi-role component. */
  roleDisplay: string;
  basis: EvidenceBasis;
  brand?: string;
  /** F4-gated. Undefined is a legitimate outcome, not a failure. */
  imageUrl?: string;
  hifiSharkUrl?: string;
  ebayUrl?: string;
}

/** Source shape — the authoritative graph node, plus what provenance computed. */
export interface ComponentSource {
  displayName: string;
  role: string;
  roles?: string[];
  product?: { brand: string; name: string; imageUrl?: string };
  brandProfile?: unknown;
  /** Canonical manufacturer designation, when corroboration established one. */
  canonicalName?: string;
  canonicalBrand?: string;
}

const ROLE_LABEL: Record<string, string> = {
  dac: 'DAC',
  streamer: 'Streamer',
  source: 'Source',
  transport: 'Transport',
  preamplifier: 'Preamplifier',
  amplifier: 'Power amplifier',
  integrated: 'Integrated amplifier',
  speaker: 'Loudspeaker',
  headphone: 'Headphones',
  turntable: 'Turntable',
  cartridge: 'Cartridge',
  tonearm: 'Tonearm',
  phono: 'Phono stage',
};

/**
 * A component with several roles states them together — the listener who wrote
 * "DAC/Streamer:" described one box doing two jobs, and flattening that back to
 * a single role discards what they told us.
 */
export function roleLabel(role: string, roles?: string[]): string {
  if (roles && roles.length > 1) {
    const labels = roles
      .filter((r) => ROLE_LABEL[r])
      .slice(0, 2)
      .map((r) => ROLE_LABEL[r]);
    if (labels.length > 1) return labels.join(' / ');
  }
  return ROLE_LABEL[role] ?? role;
}

/** Split a user-supplied name for resolvers that expect brand and model apart. */
function splitName(displayName: string): { brand?: string; name: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return { name: displayName };
  return { brand: parts[0], name: parts.slice(1).join(' ') };
}

/**
 * Build one presentation per component.
 *
 * Every resolution is per component and independent. An empty image, a missing
 * brand, or an uncorroborated identity affects only its own entry.
 */
export function buildComponentViews(
  components: ComponentSource[],
  provenance: Array<{ name: string; basis: EvidenceBasis }> | undefined,
): SystemComponentView[] {
  const basisByName = new Map(
    (provenance ?? []).map((p) => [p.name.toLowerCase().trim(), p.basis]),
  );

  return components.map((c) => {
    const listenerName = c.displayName;
    // Canonical identity wins for DISPLAY and for marketplace queries, because
    // it is the manufacturer's own designation and searches better. The
    // listener's words are kept so nothing they typed is lost.
    const displayName = c.canonicalName?.trim() || listenerName;

    const brand = c.product?.brand ?? c.canonicalBrand ?? splitName(displayName).brand;
    const modelName = c.product?.name ?? splitName(displayName).name;

    // F4 gate lives inside getProductImage. A catalogued product may carry its
    // own imageUrl; anything else must come through the curated overlay or not
    // at all. Corroboration is NOT image permission.
    const imageUrl = c.product?.imageUrl ?? getProductImage(brand, modelName);

    let hifiSharkUrl: string | undefined;
    let ebayUrl: string | undefined;
    try {
      const links = buildProductLinks({ brand, name: modelName });
      hifiSharkUrl = links.usedLinks.find((l) => /hifishark/i.test(l.url))?.url;
      ebayUrl = links.usedLinks.find((l) => /ebay\./i.test(l.url))?.url;
    } catch {
      // Commerce links are conveniences and carry no evidentiary weight;
      // failing to build one must never affect the assessment.
    }

    return {
      displayName,
      listenerName,
      role: c.role,
      roleDisplay: roleLabel(c.role, c.roles),
      basis: basisByName.get(listenerName.toLowerCase().trim()) ?? 'user',
      brand,
      imageUrl,
      hifiSharkUrl,
      ebayUrl,
    };
  });
}
