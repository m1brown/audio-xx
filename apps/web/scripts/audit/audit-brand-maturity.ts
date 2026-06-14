/**
 * Brand Authority Maturity audit — per-brand, field-level scoring.
 *
 * Enumerates every BrandProfile (via text-parsing because BRAND_PROFILES
 * isn't exported), resolves each via findBrandProfileBySlug, and scores
 * across 12 page sections of /brand/[slug]. Emits a JSON matrix + a
 * pretty table.
 *
 * Run from apps/web:
 *   npx tsx scripts/audit-brand-maturity.ts > /tmp/brand-maturity.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  findBrandProfileBySlug,
  findProductsByBrandSlug,
} from '../src/lib/consultation';
import { toSlug } from '../src/lib/route-slug';

const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO, 'audit-2026-05-29', 'brand-authority-maturity-roadmap');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Parse BRAND_PROFILES brand names from source text
const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'lib', 'consultation.ts'), 'utf-8');
const re = /\{\s*names:\s*\[\s*'([^']+)'(?:,\s*'[^']*')*\s*\]/g;
const allNames: string[] = [];
let m: RegExpExecArray | null;
while ((m = re.exec(src)) !== null) allNames.push(m[1]);
const slugs = Array.from(new Set(allNames.map((n) => toSlug(n))));

interface BrandRow {
  slug: string;
  displayName: string;
  // 12 page-section scores
  hasTagline: boolean;
  hasPhilosophy: boolean;
  hasPhilosophyExtended: boolean;
  hasDesignPhilosophy: boolean;
  hasSonicTendency: boolean;
  hasTypicalTradeoff: boolean;
  hasLeadershipOrigin: boolean;
  hasReviewerQuotes: number; // count (F4-gated rendering but field exists)
  hasTendencies: boolean;
  strengthsCount: number;
  tradeoffsCount: number;
  hasSystemContext: boolean;
  hasPairingNotes: boolean;
  designFamiliesCount: number;
  linksCount: number;
  hasLocalHero: boolean;
  hasAnyImage: boolean;
  hasVideos: boolean;
  productCount: number;
  // derived
  richnessSignals: number;
  previewEligible: boolean;
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  effortToT2: number; // 0–10 (lower = closer to T2)
}

function classify(p: any, slug: string, productCount: number): BrandRow {
  const hasTagline = !!p.tagline;
  const hasPhilosophy = !!p.philosophy;
  const hasPhilosophyExtended = !!p.philosophyExtended;
  const hasDesignPhilosophy = !!p.designPhilosophy;
  const hasSonicTendency = !!p.sonicTendency;
  const hasTypicalTradeoff = !!p.typicalTradeoff;
  const hasLeadershipOrigin = !!p.leadershipOrigin;
  const reviewerQuotes = p.reviewerQuotes?.length ?? 0;
  const hasTendencies = !!p.tendencies;
  const strengthsCount = p.strengths?.length ?? 0;
  const tradeoffsCount = p.tradeoffs?.length ?? 0;
  const hasSystemContext = !!p.systemContext;
  const hasPairingNotes = !!p.pairingNotes;
  const designFamiliesCount = p.designFamilies?.length ?? 0;
  const linksCount = p.links?.length ?? 0;
  const heroUrl = p.media?.images?.[0]?.url;
  const hasLocalHero = !!(heroUrl?.startsWith('/brand-heroes/')) ||
    !!(p.representativeImageUrl?.startsWith('/brand-heroes/'));
  const hasAnyImage = !!(heroUrl || p.representativeImageUrl);
  const hasVideos = (p.media?.videos?.length ?? 0) > 0;

  const richnessSignals =
    (hasDesignPhilosophy ? 1 : 0) +
    (hasSonicTendency ? 1 : 0) +
    (hasTypicalTradeoff ? 1 : 0) +
    (strengthsCount > 0 ? 1 : 0) +
    (tradeoffsCount > 0 ? 1 : 0) +
    (designFamiliesCount > 0 ? 1 : 0);

  const previewEligible = (hasTagline || hasPhilosophyExtended) && richnessSignals >= 2;

  // Tier classification (refined for editorial maturity):
  //   T3 flagship: hero + quick-identity + leadership + designFams + pairing +
  //                strengths/tradeoffs + anchor prose
  //   T2 strong:   hero + quick-identity triad + (strengths || tradeoffs ||
  //                designFams) + anchor prose
  //   T1 usable:   quick-identity triad authored (regardless of hero etc.)
  //   T0 thin:     missing one or more quick-identity fields
  const hasQuickIdentity = hasDesignPhilosophy && hasSonicTendency && hasTypicalTradeoff;
  const hasAnchorProse = hasTagline || hasPhilosophyExtended;
  let tier: 'T0' | 'T1' | 'T2' | 'T3';
  if (
    hasQuickIdentity &&
    hasAnchorProse &&
    hasLocalHero &&
    hasLeadershipOrigin &&
    designFamiliesCount > 0 &&
    hasPairingNotes &&
    strengthsCount > 0 &&
    tradeoffsCount > 0
  ) {
    tier = 'T3';
  } else if (
    hasQuickIdentity &&
    hasAnchorProse &&
    hasLocalHero &&
    (strengthsCount > 0 || tradeoffsCount > 0 || designFamiliesCount > 0)
  ) {
    tier = 'T2';
  } else if (hasQuickIdentity) {
    tier = 'T1';
  } else {
    tier = 'T0';
  }

  // Effort to T2: count missing pieces that block T2 promotion
  const missingForT2 = [
    !hasTagline && !hasPhilosophyExtended,
    !hasDesignPhilosophy,
    !hasSonicTendency,
    !hasTypicalTradeoff,
    strengthsCount === 0,
    tradeoffsCount === 0,
    !hasLocalHero,
    designFamiliesCount === 0,
  ].filter(Boolean).length;
  const effortToT2 = missingForT2;

  return {
    slug,
    displayName: p.names[0],
    hasTagline,
    hasPhilosophy,
    hasPhilosophyExtended,
    hasDesignPhilosophy,
    hasSonicTendency,
    hasTypicalTradeoff,
    hasLeadershipOrigin,
    hasReviewerQuotes: reviewerQuotes,
    hasTendencies,
    strengthsCount,
    tradeoffsCount,
    hasSystemContext,
    hasPairingNotes,
    designFamiliesCount,
    linksCount,
    hasLocalHero,
    hasAnyImage,
    hasVideos,
    productCount,
    richnessSignals,
    previewEligible,
    tier,
    effortToT2,
  };
}

const rows: BrandRow[] = [];
for (const slug of slugs) {
  const p: any = findBrandProfileBySlug(slug);
  if (!p) continue;
  const products = findProductsByBrandSlug(slug);
  rows.push(classify(p, slug, products.length));
}

// Sort: tier desc (T3 first), then by effortToT2 asc, then alphabetic
rows.sort((a, b) => {
  const tierRank = { T3: 0, T2: 1, T1: 2, T0: 3 } as const;
  if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
  if (a.effortToT2 !== b.effortToT2) return a.effortToT2 - b.effortToT2;
  return a.slug.localeCompare(b.slug);
});

// Summary
const tierCounts = { T0: 0, T1: 0, T2: 0, T3: 0 };
for (const r of rows) tierCounts[r.tier] += 1;

console.log(`Total BrandProfiles audited: ${rows.length}`);
console.log(`Tier distribution: T0=${tierCounts.T0} T1=${tierCounts.T1} T2=${tierCounts.T2} T3=${tierCounts.T3}`);
console.log();
console.log('=== Top 25 closest to T2 promotion (by effortToT2 asc, T1/T0 only) ===');
console.log();
const candidates = rows
  .filter((r) => r.tier === 'T1' || r.tier === 'T0')
  .sort((a, b) => {
    if (a.effortToT2 !== b.effortToT2) return a.effortToT2 - b.effortToT2;
    return b.productCount - a.productCount;
  })
  .slice(0, 25);
for (const r of candidates) {
  const missing: string[] = [];
  if (!r.hasTagline && !r.hasPhilosophyExtended) missing.push('anchor-prose');
  if (!r.hasDesignPhilosophy) missing.push('designPhil');
  if (!r.hasSonicTendency) missing.push('sonicTend');
  if (!r.hasTypicalTradeoff) missing.push('typTradeoff');
  if (r.strengthsCount === 0) missing.push('strengths');
  if (r.tradeoffsCount === 0) missing.push('tradeoffs');
  if (!r.hasLocalHero) missing.push('hero-img');
  if (r.designFamiliesCount === 0) missing.push('designFams');
  if (!r.hasLeadershipOrigin) missing.push('leadership');
  if (!r.hasPairingNotes) missing.push('pairing');
  console.log(`  ${r.tier} effort=${r.effortToT2} products=${r.productCount}  ${r.displayName.padEnd(28)} missing: ${missing.join(', ')}`);
}

console.log();
console.log('=== Full per-brand table ===');
console.log();
console.log(['tier', 'effort', 'products', 'slug', 'tagline', 'phExt', 'dPhil', 'sTend', 'tTrd', 'lead', 'rq', 'tend', 'str', 'trd', 'sCtx', 'pair', 'dFam', 'links', 'hero', 'img', 'vid'].join('\t'));
for (const r of rows) {
  console.log([
    r.tier,
    r.effortToT2,
    r.productCount,
    r.slug,
    r.hasTagline ? 1 : 0,
    r.hasPhilosophyExtended ? 1 : 0,
    r.hasDesignPhilosophy ? 1 : 0,
    r.hasSonicTendency ? 1 : 0,
    r.hasTypicalTradeoff ? 1 : 0,
    r.hasLeadershipOrigin ? 1 : 0,
    r.hasReviewerQuotes,
    r.hasTendencies ? 1 : 0,
    r.strengthsCount,
    r.tradeoffsCount,
    r.hasSystemContext ? 1 : 0,
    r.hasPairingNotes ? 1 : 0,
    r.designFamiliesCount,
    r.linksCount,
    r.hasLocalHero ? 1 : 0,
    r.hasAnyImage ? 1 : 0,
    r.hasVideos ? 1 : 0,
  ].join('\t'));
}

// Write JSON for the report to consume
fs.writeFileSync(
  path.join(OUT_DIR, 'maturity-matrix.json'),
  JSON.stringify({ tierCounts, rows }, null, 2),
);
console.log();
console.log(`Wrote ${path.relative(REPO, path.join(OUT_DIR, 'maturity-matrix.json'))}`);
