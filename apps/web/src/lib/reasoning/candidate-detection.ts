/**
 * Candidate detection — which products have entered the discussion without
 * being part of the active system, and how firmly each one's identity is
 * established (Substrate Doctrine, build item 1).
 *
 * IDENTITY DISCIPLINE (hard rule, pinned): resolution never silently
 * substitutes a successor for a predecessor, a family member for an exact
 * model, a current brand for a historical one, or one variant for another.
 * The listener's own words are the identity; a resolved product may only be
 * attached when the typed words actually name it. Anything less resolves as
 * 'ambiguous' or 'unknown' WITH the uncertainty represented — uncertainty is
 * never repaired by choosing a convenient product (the Bakoon→Enleum rule).
 */
import { extractSubjectMatches } from '@/lib/intent';
import { PRODUCT_IDENTITIES } from '@/lib/evidence/independent-review-seed';
import { findProductByComponentName } from '@/lib/consultation';
import type { IdentityResolution } from './governed-context';

export interface DetectedCandidate {
  /** The listener's words for it — always the display identity. */
  displayName: string;
  resolution: IdentityResolution;
  /** Canonical evidence key, only when resolution is 'exact'. */
  productKey?: string;
  /** Catalog product, only when the typed words name it. */
  catalogBrand?: string;
  catalogName?: string;
  identityNote?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length >= 2);

/** Do the typed words actually name this brand+model (token containment)? */
function typedWordsName(typed: string, brand: string, model: string): boolean {
  const t = new Set(tokens(typed));
  const brandTok = tokens(brand);
  const modelTok = tokens(model);
  // Every brand token OR every model token must appear in what was typed —
  // and at least one model-distinguishing token must be present, so a bare
  // brand never resolves to a specific model.
  const brandNamed = brandTok.length > 0 && brandTok.every((b) => t.has(b));
  const modelNamed = modelTok.length > 0 && modelTok.every((m) => t.has(m));
  return (brandNamed && modelNamed) || (modelNamed && modelTok.some((m) => /\d/.test(m)));
}

/** Resolve one typed name against the governed identity table. */
export function resolveCandidateIdentity(typed: string): DetectedCandidate {
  const key = norm(typed);

  // 1. Governed identity table — exact only via the curated pool, excludes
  //    honoured, and the typed words must carry the identity's own brand.
  for (const id of PRODUCT_IDENTITIES) {
    if (id.excludes.includes(key)) continue;
    const pool = [id.productKey, id.canonical.toLowerCase(), ...id.aliases.map((a) => a.toLowerCase())];
    if (pool.includes(key) || pool.includes(key.replace(/s\b/, ''))) {
      const idBrand = id.canonical.split(' ')[0].toLowerCase();
      if (!tokens(typed).some((t) => t === idBrand || id.productKey.startsWith(t))) {
        // The pool matched but the typed words do not carry this identity's
        // brand — treat as unresolved rather than substitute.
        break;
      }
      return { displayName: typed, resolution: 'exact', productKey: id.productKey };
    }
    // Near-miss on an excluded sibling: represent the ambiguity.
    if (id.excludes.some((x) => x === key)) {
      return {
        displayName: typed, resolution: 'ambiguous',
        identityNote: `"${typed}" is a different product from the ${id.canonical}; no evidence may transfer between them.`,
      };
    }
  }

  // 2. Catalog — attach only when the typed words name the product.
  const p = (findProductByComponentName as unknown as (n: string) => { brand: string; name: string } | null)(typed);
  if (p && typedWordsName(typed, p.brand, p.name)) {
    return {
      displayName: typed, resolution: 'exact', productKey: norm(`${p.brand} ${p.name}`),
      catalogBrand: p.brand, catalogName: p.name,
    };
  }
  if (p) {
    // The resolver found something the typed words do not fully name —
    // classic silent-substitution territory. Represent it instead.
    return {
      displayName: typed, resolution: 'ambiguous',
      identityNote: `"${typed}" did not name an exact model. The closest catalog identity is the ${p.brand} ${p.name}, but no evidence is attributed to "${typed}" on that basis.`,
    };
  }

  // 3. Bare brand → ambiguous (which model?); named model → unknown.
  const hasModelMorphology = tokens(typed).some((t) => /\d/.test(t)) || tokens(typed).length >= 2;
  return hasModelMorphology
    ? { displayName: typed, resolution: 'unknown', identityNote: `No catalog or evidence identity is held for "${typed}".` }
    : { displayName: typed, resolution: 'ambiguous', identityNote: `"${typed}" names a brand, not a model; which exact model is meant is not established.` };
}

/**
 * Detect candidates in the current turn: subject mentions that are not
 * components of the active system.
 */
export function detectCandidates(
  turnText: string,
  activeComponents: Array<{ displayName: string }>,
): DetectedCandidate[] {
  const activeTokens = activeComponents.map((c) => new Set(tokens(c.displayName)));
  const seen = new Set<string>();
  const out: DetectedCandidate[] = [];
  for (const m of extractSubjectMatches(turnText)) {
    const name = (m as { name?: string }).name ?? '';
    if (!name) continue;
    /*
     * The SUBJECT MATCHER may itself have resolved the mention through brand
     * aliases (this is where Bakoon became Enleum), and it may return a bare
     * brand where the listener typed brand + model. Identity here is decided
     * from the LISTENER'S WORDS: recover the typed span first, then decide
     * whether it names a system component or a candidate.
     */
    const typed = typedSpanFor(turnText, name) ?? name;
    const nk = norm(typed);
    if (seen.has(nk)) continue;
    seen.add(nk);
    // Skip mentions of the system's own components (all tokens contained).
    const mTok = tokens(typed).filter((t) => t.length >= 3);
    if (activeTokens.some((at) => mTok.length > 0 && mTok.every((t) => at.has(t)))) continue;
    out.push(resolveCandidateIdentity(typed));
  }
  return out;
}

/**
 * Recover the listener's own words for a resolved mention. Prefers the
 * longest product-ish span in the turn that contains the mention's lead
 * token, in the listener's own casing — so a matcher-shortened "hegel"
 * recovers "Hegel H590", and a matcher-renamed product recovers what was
 * actually typed.
 */
function typedSpanFor(turnText: string, resolvedName: string): string | null {
  const lead = tokens(resolvedName)[0];
  const spanRe = /\b([A-Za-z][A-Za-z0-9&.-]*(?:[ /-](?:[A-Za-z0-9/+.-]*\d[A-Za-z0-9/+.-]*|[A-Z][A-Za-z0-9.-]+|Labs?|Audio))+)\b/g;
  const trim = (span: string) => {
    let out = span;
    for (;;) {
      /*
       * Leading function words are not identity. The original list carried
       * only determiners/prepositions, so a sentence-initial auxiliary was
       * glued into the product name: "Would Wharfedale Lintons be an
       * upgrade…" detected the candidate "Would Wharfedale Lintons", whose
       * store key matches nothing — and Audio XX then told the listener the
       * specifications of a stocked product were unknown (follow-up
       * grounding P1, 2026-09-04). Auxiliaries and question words join the
       * strip list; no product identity begins with one.
       */
      const next = out.replace(/^(?:a|an|the|about|my|his|her|their|your|this|that|to|with|for|of|on|and|or|would|should|could|can|will|shall|might|must|may|do|does|did|is|are|was|were|if|whether|maybe|perhaps|how|what|when|why|also|then|so|but)\s+/i, '');
      if (next === out) return out;
      out = next;
    }
  };
  let withLead: string | null = null;
  let longest: string | null = null;
  let mm: RegExpExecArray | null;
  while ((mm = spanRe.exec(turnText)) !== null) {
    const span = trim(mm[1]);
    if (tokens(span).length === 0) continue;
    if (!longest || span.length > longest.length) longest = span;
    if (lead && norm(span).includes(lead) && (!withLead || span.length > withLead.length)) withLead = span;
  }
  if (withLead) return withLead;
  const i = turnText.toLowerCase().indexOf(resolvedName.toLowerCase());
  if (i >= 0) return turnText.slice(i, i + resolvedName.length);
  // The matcher renamed the mention (alias resolution) and the turn carries
  // no span with its lead token — the listener's own product-ish span is the
  // identity ("Bakoon AMP-13R" where the matcher said "Enleum").
  return longest;
}
