/**
 * Brand Authority Coverage Score — per-brand, 0–100% maturity index.
 *
 * Re-runnable percentage-based system that complements the T0/T1/T2/T3
 * tier audit. Score is the sum of 8 weighted dimension subscores:
 *
 *   Hero imagery        12 pts  (local hero 8 + extra images 3 + video 1)
 *   Identity layer      16 pts  (tagline 4 + designPhilosophy 4 + sonicTendency 4 + typicalTradeoff 4)
 *   Philosophy depth    10 pts  (philosophy 4 + philosophyExtended 6)
 *   Historical context  10 pts  (leadershipOrigin 10)
 *   Practical guidance  15 pts  (tendencies 5 + systemContext 5 + pairingNotes 5)
 *   Editorial depth     15 pts  (strengths up to 7.5, tradeoffs up to 7.5)
 *   Product architect.  12 pts  (designFamilies count: 0→0, 1→4, 2→8, 3+→12)
 *   Representative prod 10 pts  (share of catalog products with imageUrl × 10)
 *
 * Tier mapping (same as Phase-2 maturity audit, refined):
 *   T3 = score ≥ 90 AND has hero AND has leadershipOrigin AND ≥1 designFamily
 *        AND pairingNotes AND strengths AND tradeoffs
 *   T2 = score ≥ 70 AND has hero AND identity-layer complete
 *   T1 = identity-layer complete (Quick Identity triad authored)
 *   T0 = anything else
 *
 * Effort-to-target estimates use per-field hour costs:
 *   hero 0.5h, tagline 0.2h, identity-each 0.25h, philExt 0.5h,
 *   leadership 0.75h, pairing 0.5h, strengths 0.5h, tradeoffs 0.5h,
 *   designFamilies 1.0h
 *
 * Run from apps/web:
 *   npx tsx scripts/audit-authority-coverage.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  findBrandProfileBySlug,
  findProductsByBrandSlug,
} from '../src/lib/consultation';
import { toSlug } from '../src/lib/route-slug';

const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO, 'audit-2026-05-29', 'authority-coverage-scores');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Discover all authored brand slugs via source-text parse ──────────
const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'lib', 'consultation.ts'), 'utf-8');
const re = /\{\s*names:\s*\[\s*'([^']+)'(?:,\s*'[^']*')*\s*\]/g;
const allNames: string[] = [];
let m: RegExpExecArray | null;
while ((m = re.exec(src)) !== null) allNames.push(m[1]);
const slugs = Array.from(new Set(allNames.map((n) => toSlug(n))));

// ── Per-field hour costs (editorial estimates) ────────────────────────
const HOURS = {
  hero: 0.5,
  tagline: 0.2,
  identityField: 0.25,
  philosophyExtended: 0.5,
  leadership: 0.75,
  pairing: 0.5,
  strengths: 0.5,
  tradeoffs: 0.5,
  designFamilies: 1.0,
  extraImage: 0.3,  // per additional image beyond hero
};

interface DimensionScore {
  earned: number;
  max: number;
}

interface BrandCoverage {
  slug: string;
  displayName: string;
  // dimension subscores
  dHero: DimensionScore;
  dIdentity: DimensionScore;
  dPhilosophy: DimensionScore;
  dHistory: DimensionScore;
  dPractical: DimensionScore;
  dEditorial: DimensionScore;
  dArchitecture: DimensionScore;
  dRepresentative: DimensionScore;
  // overall
  score: number;          // 0-100 percentage
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  // missing fields
  missing: string[];
  // hours to targets
  hoursTo80: number;
  hoursTo90: number;
  hoursToT3: number;
  // raw context
  productCount: number;
  productsWithImage: number;
}

function scoreBrand(p: any, slug: string): BrandCoverage {
  const products = findProductsByBrandSlug(slug);
  const productCount = products.length;
  const productsWithImage = products.filter((pr) => !!pr.imageUrl).length;

  // ── 1. Hero imagery (12 pts) ────────────────────────────
  const heroUrl = p.media?.images?.[0]?.url;
  const hasLocalHero =
    (heroUrl && heroUrl.startsWith('/brand-heroes/')) ||
    (p.representativeImageUrl && p.representativeImageUrl.startsWith('/brand-heroes/'));
  const extraImages = Math.max(0, (p.media?.images?.length ?? 0) - 1);
  const hasVideo = (p.media?.videos?.length ?? 0) > 0;
  let heroPts = 0;
  if (hasLocalHero) heroPts += 8;
  heroPts += Math.min(3, extraImages * 1.5);
  if (hasVideo) heroPts += 1;
  const dHero: DimensionScore = { earned: heroPts, max: 12 };

  // ── 2. Identity layer (16 pts) ──────────────────────────
  const hasTagline = !!p.tagline;
  const hasDesignPhilosophy = !!p.designPhilosophy;
  const hasSonicTendency = !!p.sonicTendency;
  const hasTypicalTradeoff = !!p.typicalTradeoff;
  const dIdentity: DimensionScore = {
    earned:
      (hasTagline ? 4 : 0) +
      (hasDesignPhilosophy ? 4 : 0) +
      (hasSonicTendency ? 4 : 0) +
      (hasTypicalTradeoff ? 4 : 0),
    max: 16,
  };

  // ── 3. Philosophy depth (10 pts) ────────────────────────
  const hasPhilosophy = !!p.philosophy;
  const hasPhilosophyExtended = !!p.philosophyExtended;
  const dPhilosophy: DimensionScore = {
    earned: (hasPhilosophy ? 4 : 0) + (hasPhilosophyExtended ? 6 : 0),
    max: 10,
  };

  // ── 4. Historical context (10 pts) ──────────────────────
  const hasLeadership = !!p.leadershipOrigin;
  const dHistory: DimensionScore = { earned: hasLeadership ? 10 : 0, max: 10 };

  // ── 5. Practical guidance (15 pts) ──────────────────────
  const hasTendencies = !!p.tendencies;
  const hasSystemContext = !!p.systemContext;
  const hasPairingNotes = !!p.pairingNotes;
  const dPractical: DimensionScore = {
    earned:
      (hasTendencies ? 5 : 0) +
      (hasSystemContext ? 5 : 0) +
      (hasPairingNotes ? 5 : 0),
    max: 15,
  };

  // ── 6. Editorial depth (15 pts) — strengths 7.5 + tradeoffs 7.5 ──
  const strengthsCount = p.strengths?.length ?? 0;
  const tradeoffsCount = p.tradeoffs?.length ?? 0;
  const strengthsPts = strengthsCount === 0 ? 0 :
    strengthsCount >= 4 ? 7.5 :
    strengthsCount === 3 ? 6 :
    strengthsCount === 2 ? 4 :
    2;
  const tradeoffsPts = tradeoffsCount === 0 ? 0 :
    tradeoffsCount >= 3 ? 7.5 :
    tradeoffsCount === 2 ? 5 :
    2;
  const dEditorial: DimensionScore = {
    earned: strengthsPts + tradeoffsPts,
    max: 15,
  };

  // ── 7. Product architecture (12 pts) ────────────────────
  const designFamiliesCount = p.designFamilies?.length ?? 0;
  const dArchitecture: DimensionScore = {
    earned: designFamiliesCount >= 3 ? 12 :
            designFamiliesCount === 2 ? 8 :
            designFamiliesCount === 1 ? 4 : 0,
    max: 12,
  };

  // ── 8. Representative products (10 pts) ─────────────────
  // Share of catalog products with imageUrl × 10. Profile-only brands
  // (no catalog products) get half-credit (5) since the section renders
  // a graceful "may appear in advisory recommendations" notice.
  const dRepresentative: DimensionScore = {
    earned: productCount === 0 ? 5 :
            (productsWithImage / productCount) * 10,
    max: 10,
  };

  const totalEarned =
    dHero.earned + dIdentity.earned + dPhilosophy.earned +
    dHistory.earned + dPractical.earned + dEditorial.earned +
    dArchitecture.earned + dRepresentative.earned;
  const score = (totalEarned / 100) * 100;

  // ── Tier mapping ────────────────────────────────────────
  const identityComplete = hasDesignPhilosophy && hasSonicTendency && hasTypicalTradeoff;
  const t3Gates =
    score >= 90 &&
    hasLocalHero &&
    hasLeadership &&
    designFamiliesCount >= 1 &&
    hasPairingNotes &&
    strengthsCount > 0 &&
    tradeoffsCount > 0;
  const t2Gates =
    score >= 70 &&
    hasLocalHero &&
    identityComplete &&
    (hasTagline || hasPhilosophyExtended);
  let tier: 'T0' | 'T1' | 'T2' | 'T3';
  if (t3Gates) tier = 'T3';
  else if (t2Gates) tier = 'T2';
  else if (identityComplete) tier = 'T1';
  else tier = 'T0';

  // ── Missing fields summary ──────────────────────────────
  const missing: string[] = [];
  if (!hasLocalHero) missing.push('hero');
  if (!hasTagline) missing.push('tagline');
  if (!hasDesignPhilosophy) missing.push('designPhilosophy');
  if (!hasSonicTendency) missing.push('sonicTendency');
  if (!hasTypicalTradeoff) missing.push('typicalTradeoff');
  if (!hasPhilosophyExtended) missing.push('philosophyExtended');
  if (!hasLeadership) missing.push('leadershipOrigin');
  if (!hasPairingNotes) missing.push('pairingNotes');
  if (strengthsCount === 0) missing.push('strengths');
  if (tradeoffsCount === 0) missing.push('tradeoffs');
  if (designFamiliesCount === 0) missing.push('designFamilies');

  // ── Hours-to-target estimation ──────────────────────────
  // We compute hours by greedy-adding the missing fields ordered by
  // earned-pts-per-hour, accumulating until the target is reached.
  const fieldOpportunities: Array<{ name: string; pts: number; hours: number; apply: () => number }> = [];
  let dynamicScore = score;
  let dynamicHero = hasLocalHero;
  let dynamicLeadership = hasLeadership;
  let dynamicDesignFamilies = designFamiliesCount;
  let dynamicPairing = hasPairingNotes;
  let dynamicStrengths = strengthsCount;
  let dynamicTradeoffs = tradeoffsCount;

  function addable() {
    const opts: Array<{ name: string; pts: number; hours: number; apply: () => void }> = [];
    if (!dynamicHero) opts.push({ name: 'hero', pts: 8, hours: HOURS.hero, apply: () => { dynamicHero = true; dynamicScore += 8; } });
    if (!hasTagline) opts.push({ name: 'tagline', pts: 4, hours: HOURS.tagline, apply: () => { dynamicScore += 4; } });
    if (!hasDesignPhilosophy) opts.push({ name: 'designPhilosophy', pts: 4, hours: HOURS.identityField, apply: () => { dynamicScore += 4; } });
    if (!hasSonicTendency) opts.push({ name: 'sonicTendency', pts: 4, hours: HOURS.identityField, apply: () => { dynamicScore += 4; } });
    if (!hasTypicalTradeoff) opts.push({ name: 'typicalTradeoff', pts: 4, hours: HOURS.identityField, apply: () => { dynamicScore += 4; } });
    if (!hasPhilosophyExtended) opts.push({ name: 'philosophyExtended', pts: 6, hours: HOURS.philosophyExtended, apply: () => { dynamicScore += 6; } });
    if (!dynamicLeadership) opts.push({ name: 'leadershipOrigin', pts: 10, hours: HOURS.leadership, apply: () => { dynamicLeadership = true; dynamicScore += 10; } });
    if (!dynamicPairing) opts.push({ name: 'pairingNotes', pts: 5, hours: HOURS.pairing, apply: () => { dynamicPairing = true; dynamicScore += 5; } });
    if (dynamicStrengths === 0) opts.push({ name: 'strengths', pts: 7.5, hours: HOURS.strengths, apply: () => { dynamicStrengths = 4; dynamicScore += 7.5; } });
    if (dynamicTradeoffs === 0) opts.push({ name: 'tradeoffs', pts: 7.5, hours: HOURS.tradeoffs, apply: () => { dynamicTradeoffs = 3; dynamicScore += 7.5; } });
    if (dynamicDesignFamilies === 0) opts.push({ name: 'designFamilies', pts: 12, hours: HOURS.designFamilies, apply: () => { dynamicDesignFamilies = 3; dynamicScore += 12; } });
    return opts;
  }

  function greedyHoursTo(targetScore: number, requireGates?: () => boolean): number {
    let hours = 0;
    const maxIter = 30;
    for (let i = 0; i < maxIter; i++) {
      if (dynamicScore >= targetScore && (!requireGates || requireGates())) return hours;
      const opts = addable().sort((a, b) => (b.pts / b.hours) - (a.pts / a.hours));
      if (opts.length === 0) return hours; // can't reach target — return current
      const pick = opts[0];
      pick.apply();
      hours += pick.hours;
    }
    return hours;
  }

  // Hours to 80% — pure score threshold
  const hoursTo80 = greedyHoursTo(80);
  // Reset dynamic state for 90%
  dynamicScore = score; dynamicHero = hasLocalHero; dynamicLeadership = hasLeadership;
  dynamicDesignFamilies = designFamiliesCount; dynamicPairing = hasPairingNotes;
  dynamicStrengths = strengthsCount; dynamicTradeoffs = tradeoffsCount;
  const hoursTo90 = greedyHoursTo(90);
  // Reset for T3
  dynamicScore = score; dynamicHero = hasLocalHero; dynamicLeadership = hasLeadership;
  dynamicDesignFamilies = designFamiliesCount; dynamicPairing = hasPairingNotes;
  dynamicStrengths = strengthsCount; dynamicTradeoffs = tradeoffsCount;
  const hoursToT3 = greedyHoursTo(90, () => dynamicHero && dynamicLeadership && dynamicDesignFamilies >= 1 && dynamicPairing && dynamicStrengths > 0 && dynamicTradeoffs > 0);

  return {
    slug,
    displayName: p.names[0],
    dHero, dIdentity, dPhilosophy, dHistory, dPractical, dEditorial,
    dArchitecture, dRepresentative,
    score: Math.round(score * 10) / 10,
    tier,
    missing,
    hoursTo80: Math.round(hoursTo80 * 10) / 10,
    hoursTo90: Math.round(hoursTo90 * 10) / 10,
    hoursToT3: Math.round(hoursToT3 * 10) / 10,
    productCount,
    productsWithImage,
  };
}

const rows: BrandCoverage[] = [];
for (const slug of slugs) {
  const p: any = findBrandProfileBySlug(slug);
  if (!p) continue;
  rows.push(scoreBrand(p, slug));
}

rows.sort((a, b) => b.score - a.score);

// ── Pretty print ────────────────────────────────────────
const tierCounts = { T0: 0, T1: 0, T2: 0, T3: 0 };
for (const r of rows) tierCounts[r.tier] += 1;

console.log(`Total BrandProfiles scored: ${rows.length}`);
console.log(`Tier distribution: T0=${tierCounts.T0} T1=${tierCounts.T1} T2=${tierCounts.T2} T3=${tierCounts.T3}`);
const avgScore = rows.reduce((a, r) => a + r.score, 0) / rows.length;
const medianScore = [...rows].sort((a, b) => a.score - b.score)[Math.floor(rows.length / 2)].score;
console.log(`Average score: ${avgScore.toFixed(1)}%  Median: ${medianScore.toFixed(1)}%`);
console.log();

console.log('=== Full ranked table (score desc) ===');
const fmt = (n: number) => n.toFixed(1).padStart(5);
const hdr = ['Rank', 'Score%', 'Tier', 'Brand', 'Hero', 'Ident', 'Phil', 'Hist', 'Prac', 'Edit', 'Arch', 'Repr', '→80h', '→90h', '→T3h', 'prods'];
console.log(hdr.join('\t'));
rows.forEach((r, i) => {
  console.log([
    (i + 1).toString(),
    fmt(r.score),
    r.tier,
    r.displayName.padEnd(22),
    `${r.dHero.earned.toFixed(1)}/${r.dHero.max}`,
    `${r.dIdentity.earned}/${r.dIdentity.max}`,
    `${r.dPhilosophy.earned}/${r.dPhilosophy.max}`,
    `${r.dHistory.earned}/${r.dHistory.max}`,
    `${r.dPractical.earned}/${r.dPractical.max}`,
    `${r.dEditorial.earned.toFixed(1)}/${r.dEditorial.max}`,
    `${r.dArchitecture.earned}/${r.dArchitecture.max}`,
    `${r.dRepresentative.earned.toFixed(1)}/${r.dRepresentative.max}`,
    r.hoursTo80.toFixed(1),
    r.hoursTo90.toFixed(1),
    r.hoursToT3.toFixed(1),
    r.productCount,
  ].join('\t'));
});

// Write JSON for the report
fs.writeFileSync(
  path.join(OUT_DIR, 'authority-coverage.json'),
  JSON.stringify({
    summary: {
      generatedAt: new Date().toISOString(),
      total: rows.length,
      tierCounts,
      averageScore: Math.round(avgScore * 10) / 10,
      medianScore,
    },
    rows,
  }, null, 2),
);
console.log(`\nWrote ${path.relative(REPO, path.join(OUT_DIR, 'authority-coverage.json'))}`);
