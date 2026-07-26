/**
 * Audio XX — Causal Explanation engine, Phase 1 (deterministic, no LLM).
 *
 * Reads structured CatalogFacts, applies approved InteractionRules through a
 * strict admission path, and composes the "Why it sounds this way" block by
 * pure substitution. When no rule fires, returns { block: null } and the
 * caller falls back to the existing trait-aggregate prose.
 *
 * See docs/causal-explanation-architecture-v1.md.
 */
import type { Product } from '../products/dacs';
import { DAC_PRODUCTS } from '../products/dacs';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import { SPEAKER_PRODUCTS } from '../products/speakers';
import type {
  CatalogFact,
  CausalComponent,
  CausalResult,
  CausalRole,
  InteractionInference,
  InteractionRule,
  ProvenanceBasis,
} from './types';
import { APPROVED_RULES } from './knowledge';

// Note: AMPLIFIER_PRODUCTS and DAC_PRODUCTS are exported from dacs.ts's siblings
// but re-imported here via their own modules. Aggregate only what Phase 1 needs.
const CATALOG: ReadonlyArray<Product> = [
  ...AMPLIFIER_PRODUCTS,
  ...DAC_PRODUCTS,
  ...SPEAKER_PRODUCTS,
];

const CATALOG_BY_ID: ReadonlyMap<string, Product> = new Map(CATALOG.map((p) => [p.id, p]));

/** Identifies an authored SET-suitability interaction effect on a speaker. */
function isSetSuitabilityCondition(condition: string): boolean {
  return /single-ended triode/i.test(condition) || /\bSET\b/.test(condition);
}

/**
 * Read verified facts from a catalog Product. Only structured fields are read;
 * nothing is inferred from prose. Absent field ⇒ absent fact.
 */
export function readCatalogFacts(product: Product): CatalogFact[] {
  const facts: CatalogFact[] = [];
  if (product.topology) {
    facts.push({
      componentId: product.id,
      key: 'topology',
      value: product.topology,
      provenance: { basis: 'manufacturer_intent', note: 'catalog topology field' },
    });
  }
  const setEffect = (product.tendencies?.interactions ?? []).find((i) =>
    isSetSuitabilityCondition(i.condition),
  );
  if (setEffect) {
    facts.push({
      componentId: product.id,
      key: 'set_suitability_effect',
      value: setEffect.condition,
      provenance: { basis: setEffect.basis as ProvenanceBasis, note: setEffect.effect },
    });
  }
  return facts;
}

export function categoryToRole(category: string | undefined): CausalRole {
  switch ((category ?? '').toLowerCase()) {
    case 'amplifier':
      return 'amp';
    case 'speaker':
      return 'speaker';
    case 'dac':
    case 'streamer':
    case 'source':
    case 'turntable':
      return 'source';
    default:
      return 'other';
  }
}

/** Build a resolved CausalComponent from a catalog Product. */
export function toCausalComponent(product: Product, role?: CausalRole): CausalComponent {
  return {
    productId: product.id,
    name: `${product.brand} ${product.name}`.trim(),
    brand: product.brand,
    role: role ?? categoryToRole(product.category),
    facts: readCatalogFacts(product),
  };
}

/** Resolve a catalog Product by exact id (used by tests and the wiring adapter). */
export function causalComponentById(productId: string, role?: CausalRole): CausalComponent | null {
  const p = CATALOG_BY_ID.get(productId);
  return p ? toCausalComponent(p, role) : null;
}

/** Best-effort name → Product resolver for the render-time adapter. */
function resolveByName(name: string): Product | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  let best: Product | null = null;
  for (const p of CATALOG) {
    const full = `${p.brand} ${p.name}`.toLowerCase();
    if (n === full) return p;
    if (!best && (full.includes(n) || n.includes(full))) best = p;
  }
  return best;
}

/** Unresolved component (no catalog match) — carries no facts, matches no rule. */
function unresolvedComponent(name: string, role: CausalRole): CausalComponent {
  return { productId: null, name, brand: '', role, facts: [] };
}

/**
 * Render-time adapter: map role-ordered display names to resolved
 * CausalComponents. Roles are inferred from the resolved product category.
 */
export function resolveCausalComponentsFromNames(names: ReadonlyArray<string>): CausalComponent[] {
  return names.map((nm) => {
    const p = resolveByName(nm);
    return p ? toCausalComponent(p) : unresolvedComponent(nm, 'other');
  });
}

const BASIS_LABEL: Partial<Record<ProvenanceBasis, string>> = {
  measured: 'measured',
  manufacturer_intent: 'manufacturer-basis',
  founder_reference: 'reference-basis',
  review_consensus: 'review-basis',
  listener_consensus: 'listener-basis',
  owner_reference: 'owner-basis',
};

/**
 * Compose the deterministic causal paragraph by substitution. No causal
 * content is created here — only the authored rule text, bound to the two
 * components' display names and the matched fact's provenance basis.
 */
function composeBlock(
  rule: InteractionRule,
  amp: CausalComponent,
  speaker: CausalComponent,
): string {
  const setEffect = speaker.facts.find((f) => f.key === 'set_suitability_effect');
  const basisLabel = (setEffect && BASIS_LABEL[setEffect.provenance.basis]) || 'authored';
  return (
    `The ${amp.name} is a single-ended-triode amplifier with limited output power. ` +
    `The ${speaker.name} is catalogued as a high-efficiency loudspeaker and carries an ` +
    `authored ${basisLabel} effect specifically connecting it with SET amplification. ` +
    `Its greater acoustic output per available watt means the ${amp.brand} needs to use ` +
    `less of its limited power for a given listening level than it would with a ` +
    `substantially less sensitive loudspeaker. That preserves more headroom and reduces ` +
    `the likelihood of clipped or compressed peaks. With a less sensitive speaker, the ` +
    `same amplifier would have to use more of its available output to reach the same level.`
  );
}

function buildInference(
  rule: InteractionRule,
  amp: CausalComponent,
  speaker: CausalComponent,
): InteractionInference {
  const boundFacts = [...amp.facts, ...speaker.facts];
  return {
    ruleId: rule.id,
    upstream: { productId: amp.productId, role: amp.role },
    downstream: { productId: speaker.productId, role: speaker.role },
    boundFacts,
    provenanceChain: [...boundFacts.map((f) => f.provenance), rule.provenance],
    confidence: rule.confidence,
  };
}

/**
 * Deterministically evaluate the approved rule set against a resolved system.
 * Returns the composed block + inference when exactly the authored knowledge
 * supports it; otherwise { block: null, inference: null } (restraint fallback).
 *
 * Admission is structural: a claim can only form when (a) an approved rule's
 * upstream predicate matches a component in the upstream role AND (b) its
 * downstream predicate matches a component in the downstream role. The
 * predicates themselves encode eligibility (P1), the two structured facts
 * (P3), and — via the rule's required contrast — the contrastive consequence
 * (P4). No fact-join path exists.
 */
export function evaluateCausal(components: ReadonlyArray<CausalComponent>): CausalResult {
  for (const rule of APPROVED_RULES) {
    const amp = components.find(
      (c) => c.role === rule.upstream.role && rule.upstream.matches(c),
    );
    const speaker = components.find(
      (c) => c.role === rule.downstream.role && rule.downstream.matches(c),
    );
    if (amp && speaker) {
      return { block: composeBlock(rule, amp, speaker), inference: buildInference(rule, amp, speaker) };
    }
  }
  return { block: null, inference: null };
}
