/**
 * System extraction — detect and extract system descriptions from conversation.
 *
 * Phase 5: conservative detection of user-described audio systems.
 *
 * Design principles:
 *   - Only trigger on ownership language ("I have", "my system", "I'm running")
 *   - Require at least 2 recognized components
 *   - Never trigger on comparisons, shopping, or aspirational language
 *   - Produce a ProposedSystem only when there's enough evidence
 *   - Fingerprint-based duplicate suppression
 */

import type { SubjectMatch } from './intent';
import type { ProductCategory } from './catalog-taxonomy';
import type { ProposedSystem, DraftSystemComponent, AudioSessionState } from './system-types';

// ── Brand → category mapping ──────────────────────────
// Best-effort category assignment for known brands.
// Not exhaustive — unknown brands default to 'other'.

const BRAND_CATEGORY_MAP: Record<string, ProductCategory> = {
  // DAC / digital
  denafrips: 'dac', chord: 'dac', schiit: 'dac', topping: 'dac', smsl: 'dac',
  gustard: 'dac', holo: 'dac', benchmark: 'dac', rme: 'dac', mytek: 'dac',
  weiss: 'dac', 'mola mola': 'dac', rockna: 'dac', aqua: 'dac',
  lampizator: 'dac', lampi: 'dac', 'border patrol': 'dac', metrum: 'dac',
  'audio-gd': 'dac', soekris: 'dac', musician: 'dac', okto: 'dac',
  // Speakers
  harbeth: 'speaker', devore: 'speaker', zu: 'speaker', klipsch: 'speaker',
  focal: 'speaker', boenicke: 'speaker', kef: 'speaker', 'b&w': 'speaker',
  bowers: 'speaker', dynaudio: 'speaker', wilson: 'speaker', magico: 'speaker',
  'sonus faber': 'speaker', proac: 'speaker', spendor: 'speaker', atc: 'speaker',
  tannoy: 'speaker', magnepan: 'speaker', 'martin logan': 'speaker', quad: 'speaker',
  wlm: 'speaker',
  // Amplifiers
  'pass labs': 'amplifier', 'first watt': 'amplifier', naim: 'amplifier',
  luxman: 'amplifier', accuphase: 'amplifier', parasound: 'amplifier',
  hegel: 'integrated', mcintosh: 'amplifier', marantz: 'amplifier',
  shindo: 'amplifier', leben: 'amplifier', 'audio note': 'amplifier',
  'line magnetic': 'amplifier', primaluna: 'amplifier', cary: 'amplifier',
  'audio research': 'amplifier', arc: 'amplifier', job: 'integrated',
  // Turntables
  rega: 'turntable', 'pro-ject': 'turntable', technics: 'turntable',
  clearaudio: 'turntable', vpi: 'turntable', linn: 'turntable', thorens: 'turntable',
  // Headphones
  sennheiser: 'headphone', 'audio-technica': 'headphone', beyerdynamic: 'headphone',
  hifiman: 'headphone', audeze: 'headphone',
  // IEMs
  moondrop: 'iem', shure: 'iem', etymotic: 'iem',
};

// ── Product → brand+category fallback ─────────────────
// For recognized products that appear without their brand name.

const PRODUCT_HINTS: Record<string, { brand: string; category: ProductCategory }> = {
  // Denafrips
  ares: { brand: 'Denafrips', category: 'dac' },
  pontus: { brand: 'Denafrips', category: 'dac' },
  venus: { brand: 'Denafrips', category: 'dac' },
  terminator: { brand: 'Denafrips', category: 'dac' },
  // Schiit
  bifrost: { brand: 'Schiit', category: 'dac' },
  gungnir: { brand: 'Schiit', category: 'dac' },
  yggdrasil: { brand: 'Schiit', category: 'dac' },
  modi: { brand: 'Schiit', category: 'dac' },
  modius: { brand: 'Schiit', category: 'dac' },
  // Chord (compound names first so longer keys match before shorter)
  'hugo tt2': { brand: 'Chord', category: 'dac' },
  'hugo tt': { brand: 'Chord', category: 'dac' },
  'hugo 2': { brand: 'Chord', category: 'dac' },
  qutest: { brand: 'Chord', category: 'dac' },
  hugo: { brand: 'Chord', category: 'dac' },
  dave: { brand: 'Chord', category: 'dac' },
  mojo: { brand: 'Chord', category: 'dac' },
  tt2: { brand: 'Chord', category: 'dac' },
  // Speakers
  'o/96': { brand: 'DeVore', category: 'speaker' },
  o96: { brand: 'DeVore', category: 'speaker' },
  orangutan: { brand: 'DeVore', category: 'speaker' },
  p3esr: { brand: 'Harbeth', category: 'speaker' },
  'super hl5': { brand: 'Harbeth', category: 'speaker' },
  diva: { brand: 'WLM', category: 'speaker' },
  'diva monitor': { brand: 'WLM', category: 'speaker' },
  heresy: { brand: 'Klipsch', category: 'speaker' },
  // Headphones
  'hd 600': { brand: 'Sennheiser', category: 'headphone' },
  'hd 650': { brand: 'Sennheiser', category: 'headphone' },
  'hd 800': { brand: 'Sennheiser', category: 'headphone' },
  'hd 800 s': { brand: 'Sennheiser', category: 'headphone' },
  sundara: { brand: 'HiFiMAN', category: 'headphone' },
  'edition xs': { brand: 'HiFiMAN', category: 'headphone' },
};

// ── Ownership patterns ────────────────────────────────
// Must strongly indicate the user owns this gear, not merely asking about it.

const STRONG_OWNERSHIP_RE = [
  /\bi\s+have\b/i,
  /\bmy\s+(?:current\s+)?(?:system|setup|rig|chain|gear)\b/i,
  /\bi(?:'m|\s+am)\s+(?:running|using|driving|playing\s+through)\b/i,
  /\bi\s+(?:run|use|own)\b/i,
  /\bcurrent\s+(?:system|setup|rig|chain)\b.*:/i,       // "Current setup: ..."
  /\bmy\s+(?:dac|amp|amplifier|speakers?|headphones?|turntable|streamer)\b/i,
];

// ── Anti-patterns: aspirational, comparative, hypothetical ──

const ANTI_OWNERSHIP_RE = [
  /\bconsidering\b/i,
  /\bthinking\s+(?:about|of)\s+(?:getting|buying|trying)\b/i,
  /\bwould\s+(?:a|the)\b/i,
  /\bhow\s+(?:does|would|do)\b/i,
  /\bcompare\b/i,
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bwhich\s+(?:is|would)\b/i,
  /\bbetter\s+(?:than|for)\b/i,
  /\bshould\s+i\s+(?:get|buy|try)\b/i,
  /\brecommend\b/i,
  /\bwhat\s+(?:dac|amp|speaker)\b/i,
  /\bbest\b.*\bunder\b/i,
];

// ── Generic component descriptors ─────────────────────
// Words that indicate a component type even without a recognized brand.
// Only used to augment subject matches with unrecognized gear.

const GENERIC_COMPONENT_RE: { pattern: RegExp; category: ProductCategory }[] = [
  { pattern: /\btube\s+(?:amp|amplifier|integrated)\b/i, category: 'amplifier' },
  { pattern: /\bsolid[- ]state\s+(?:amp|amplifier|integrated)\b/i, category: 'amplifier' },
  { pattern: /\bintegrated\s+amp(?:lifier)?\b/i, category: 'integrated' },
  { pattern: /\bpower\s+amp(?:lifier)?\b/i, category: 'amplifier' },
  { pattern: /\bpreamp(?:lifier)?\b/i, category: 'amplifier' },
  { pattern: /\bheadphone\s+amp\b/i, category: 'amplifier' },
  { pattern: /\bvinyl\s+(?:setup|rig|front\s+end)\b/i, category: 'turntable' },
  { pattern: /\bturntable\b/i, category: 'turntable' },
  { pattern: /\bstreamer\b/i, category: 'streamer' },
  { pattern: /\bphono\s+(?:stage|preamp)\b/i, category: 'phono' },
];

// ── Public API ──────────────────────────────────────────

/**
 * Detect whether a user message describes an owned audio system.
 *
 * Returns a ProposedSystem if there's strong evidence of ownership
 * language plus at least 2 recognizable component subjects.
 * Returns null otherwise.
 *
 * This function is intentionally conservative — it's better to
 * miss a system description than to prompt inappropriately.
 */
export function detectSystemDescription(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
  audioState: AudioSessionState,
): ProposedSystem | null {
  // ── Gate 1: ownership language required ──
  const hasOwnership = STRONG_OWNERSHIP_RE.some((re) => re.test(currentMessage));
  if (!hasOwnership) return null;

  // ── Gate 2: anti-patterns disqualify ──
  const hasAntiPattern = ANTI_OWNERSHIP_RE.some((re) => re.test(currentMessage));
  if (hasAntiPattern) return null;

  // ── Gate 3: need at least 2 recognized subjects ──
  if (subjectMatches.length < 2) return null;

  // ── Build components from subject matches ──
  const components: DraftSystemComponent[] = [];
  const seen = new Set<string>();

  for (const match of subjectMatches) {
    const key = match.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (match.kind === 'product') {
      // Product match — look up brand and category
      const hint = PRODUCT_HINTS[key];
      if (hint) {
        components.push({
          brand: hint.brand,
          name: capitalize(match.name),
          category: hint.category,
          role: null,
        });
      } else {
        // Product without known hint — try to associate with a brand match
        const brandMatch = subjectMatches.find(
          (m) => m.kind === 'brand' && !seen.has(`used:${m.name.toLowerCase()}`),
        );
        if (brandMatch) {
          seen.add(`used:${brandMatch.name.toLowerCase()}`);
          components.push({
            brand: capitalize(brandMatch.name),
            name: capitalize(match.name),
            category: BRAND_CATEGORY_MAP[brandMatch.name.toLowerCase()] ?? 'other',
            role: null,
          });
        } else {
          components.push({
            brand: '',
            name: capitalize(match.name),
            category: 'other',
            role: null,
          });
        }
      }
    } else {
      // Brand match — use as a component with brand = name
      const category = BRAND_CATEGORY_MAP[key] ?? 'other';
      components.push({
        brand: capitalize(match.name),
        name: '',  // Brand-only — user can fill in model in editor
        category,
        role: null,
      });
    }
  }

  // Also pick up generic component descriptors not in subject matches
  for (const { pattern, category } of GENERIC_COMPONENT_RE) {
    const m = currentMessage.match(pattern);
    if (m) {
      const desc = m[0];
      const descKey = desc.toLowerCase();
      if (!seen.has(descKey) && !components.some((c) => c.name.toLowerCase() === descKey)) {
        seen.add(descKey);
        components.push({
          brand: '',
          name: desc,
          category,
          role: null,
        });
      }
    }
  }

  // ── Gate 4: need at least 2 real components ──
  if (components.length < 2) return null;

  // ── Build fingerprint for duplicate suppression ──
  const fingerprint = buildFingerprint(components);

  // ── Gate 5: check for duplicate against active system ──
  if (isDuplicateOfActiveSystem(fingerprint, audioState)) return null;

  // ── Gate 6: check for duplicate against previously dismissed proposal ──
  // (handled externally via dismissedFingerprints in page.tsx)

  // ── Build suggested name ──
  const suggestedName = suggestSystemName(components);

  return {
    suggestedName,
    components,
    sourceQuery: currentMessage,
    fingerprint,
  };
}

// ── Helpers ────────────────────────────────────────────

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build a stable fingerprint from component list for dedup.
 * Sorted, lowercased brand+name joined with |.
 */
function buildFingerprint(components: DraftSystemComponent[]): string {
  return components
    .map((c) => `${c.brand.toLowerCase().trim()}:${c.name.toLowerCase().trim()}`)
    .sort()
    .join('|');
}

/**
 * Check if the proposed system is substantially the same as the active system.
 * Uses component brand+name overlap — if 70%+ of proposed components match
 * the active system, consider it a duplicate.
 */
function isDuplicateOfActiveSystem(
  fingerprint: string,
  state: AudioSessionState,
): boolean {
  const { activeSystemRef, savedSystems, draftSystem } = state;
  if (!activeSystemRef) return false;

  let activeComponents: Array<{ brand: string; name: string }> = [];

  if (activeSystemRef.kind === 'draft' && draftSystem) {
    activeComponents = draftSystem.components;
  } else if (activeSystemRef.kind === 'saved') {
    const saved = savedSystems.find((s) => s.id === activeSystemRef.id);
    if (saved) activeComponents = saved.components;
  }

  if (activeComponents.length === 0) return false;

  const activeFingerprint = activeComponents
    .map((c) => `${c.brand.toLowerCase().trim()}:${c.name.toLowerCase().trim()}`)
    .sort()
    .join('|');

  // Exact match
  if (fingerprint === activeFingerprint) return true;

  // Partial overlap: count matching segments
  const proposedParts = new Set(fingerprint.split('|'));
  const activeParts = activeFingerprint.split('|');
  const matches = activeParts.filter((p) => proposedParts.has(p)).length;

  // If 70%+ of active components appear in proposed, treat as duplicate
  return activeParts.length > 0 && matches / activeParts.length >= 0.7;
}

/**
 * Suggest a system name from component categories.
 */
function suggestSystemName(components: DraftSystemComponent[]): string {
  const categories = new Set(components.map((c) => c.category));
  if (categories.has('headphone') || categories.has('iem')) {
    return 'Headphone System';
  }
  if (categories.has('speaker')) {
    return 'Speaker System';
  }
  return 'My System';
}
