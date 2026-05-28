/**
 * Audio XX — Manufacturer Integrity Audit (Phase 1, data only).
 *
 * Walks the BRAND_PROFILES array in apps/web/src/lib/consultation.ts,
 * extracts each brand's metadata, classifies external links, HEAD-probes
 * every URL (image + link) it finds, and writes five output files into
 *   audit-2026-05-21/manufacturer-integrity/
 *
 *   - manufacturer-audit.json     (per-brand machine-readable record)
 *   - manufacturer-link-report.csv (every link, classified, with probe result)
 *   - missing-images.csv          (brands with no image, or images failing the probe)
 *   - dead-links.csv              (any external URL returning non-2xx or transport error)
 *   - duplicate-aliases.csv       (cross-brand name collisions)
 *
 * Read-only with respect to product code. The script reads consultation.ts
 * as text and parses brand entries via depth-aware brace walking — it does
 * NOT mutate any catalog file, does NOT add exports, does NOT touch
 * affiliate config. Probe results are written only under the audit dir.
 *
 * Run:
 *   cd apps/web
 *   npx tsx scripts/audit-manufacturers.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Paths ────────────────────────────────────────────────────────────

const APPS_WEB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APPS_WEB_ROOT, '..', '..');
const CONSULTATION_PATH = path.join(
  APPS_WEB_ROOT,
  'src',
  'lib',
  'consultation.ts',
);
const OUT_DIR = path.join(
  REPO_ROOT,
  'audit-2026-05-21',
  'manufacturer-integrity',
);

// ── Slug helper (mirrors apps/web/src/lib/route-slug.ts) ─────────────

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── BRAND_PROFILES text parsing ──────────────────────────────────────

interface RawLink {
  label: string;
  url: string;
  kind?: string;
  region?: string;
}

interface RawImage {
  url: string;
  caption?: string;
  credit?: string;
  sourceUrl?: string;
}

interface BrandRecord {
  slug: string;
  primaryName: string;
  names: string[];
  // presence flags
  hasPhilosophy: boolean;
  hasPhilosophyExtended: boolean;
  hasTendencies: boolean;
  hasSystemContext: boolean;
  hasPairingNotes: boolean;
  hasLeadershipOrigin: boolean;
  hasReviewerQuotes: boolean;
  hasStrengths: boolean;
  hasTradeoffs: boolean;
  hasDesignFamilies: boolean;
  hasTagline: boolean;
  hasDesignPhilosophy: boolean;
  hasSonicTendency: boolean;
  hasTypicalTradeoff: boolean;
  hasRepresentativeImageUrl: boolean;
  hasLogoUrl: boolean;
  hasSecondaryImageUrl: boolean;
  // structured data
  links: RawLink[];
  mediaImages: RawImage[];
  // bookkeeping
  blockStartLine: number;
}

/**
 * Read consultation.ts and return the substring containing the
 * BRAND_PROFILES array body (between the opening `[` and matching `]`).
 * Tracks string state so braces inside template literals or quoted
 * strings don't confuse the depth counter.
 */
function extractBrandProfilesBody(src: string): { body: string; startLine: number } {
  const marker = /const BRAND_PROFILES: BrandProfile\[\] = \[/;
  const m = marker.exec(src);
  if (!m) throw new Error('BRAND_PROFILES array not found');

  const startIdx = m.index + m[0].length; // first char after the opening `[`
  let depthBracket = 1; // we just consumed `[`
  let depthBrace = 0;
  let inString: false | "'" | '"' | '`' = false;
  let escape = false;
  let i = startIdx;

  for (; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inString) { inString = false; continue; }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch as "'" | '"' | '`'; continue; }
    if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace--;
    else if (ch === '[') depthBracket++;
    else if (ch === ']') {
      depthBracket--;
      if (depthBracket === 0 && depthBrace === 0) {
        break;
      }
    }
  }

  // Compute line number for the `const BRAND_PROFILES` declaration.
  const startLine = src.slice(0, m.index).split('\n').length;
  return { body: src.slice(startIdx, i), startLine };
}

/**
 * Split a brand-profiles array body into top-level entry-object texts.
 * Each entry is the text BETWEEN matching `{` `}` at depth 1 of the
 * outer array. The opening `{` and closing `}` are included in the
 * returned slice.
 */
function splitTopLevelObjects(body: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  let depthBrace = 0;
  let depthBracket = 0;
  let inString: false | "'" | '"' | '`' = false;
  let escape = false;
  let entryStart = -1;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inString) { inString = false; continue; }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch as "'" | '"' | '`'; continue; }
    if (ch === '{') {
      if (depthBrace === 0 && depthBracket === 0) entryStart = i;
      depthBrace++;
    } else if (ch === '}') {
      depthBrace--;
      if (depthBrace === 0 && depthBracket === 0 && entryStart >= 0) {
        out.push({ text: body.slice(entryStart, i + 1), offset: entryStart });
        entryStart = -1;
      }
    } else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket--;
  }
  return out;
}

/**
 * Tolerant single-line names array parser. The catalog file consistently
 * writes `names: ['a', 'b', 'c'],` on one line.
 */
function extractNames(entryText: string): string[] {
  const m = /^\s*names:\s*\[([^\]]+)\]/m.exec(entryText);
  if (!m) return [];
  const inner = m[1];
  const out: string[] = [];
  const re = /'([^']*)'|"([^"]*)"/g;
  let s: RegExpExecArray | null;
  while ((s = re.exec(inner)) !== null) {
    out.push((s[1] ?? s[2] ?? '').trim());
  }
  return out.filter(Boolean);
}

/**
 * Walk an array-of-objects field and return each entry as raw text.
 * Used for `links: [ {...}, {...} ]` and `media: { images: [ {...} ] }`.
 * Returns null when the named array isn't found.
 */
function extractArrayObjects(
  entryText: string,
  arrayPath: string,
): string[] | null {
  // Find the field start by scanning for `^\s*<path>:\s*\[`. For nested
  // paths like 'media.images', split and find each segment in turn.
  const segments = arrayPath.split('.');
  let i = 0;
  for (let seg = 0; seg < segments.length; seg++) {
    const name = segments[seg];
    const isLast = seg === segments.length - 1;
    const re = new RegExp(`\\b${name}:\\s*${isLast ? '\\[' : '\\{'}`);
    re.lastIndex = i;
    const m = re.exec(entryText.slice(i));
    if (!m) return null;
    i = i + m.index + m[0].length;
  }
  // i now sits just after the opening `[` of the array.
  // Walk to the matching `]` collecting objects.
  let depthBracket = 1;
  let depthBrace = 0;
  let inString: false | "'" | '"' | '`' = false;
  let escape = false;
  let objStart = -1;
  const out: string[] = [];

  for (; i < entryText.length; i++) {
    const ch = entryText[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inString) { inString = false; continue; }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch as "'" | '"' | '`'; continue; }
    if (ch === '{') {
      if (depthBrace === 0 && depthBracket === 1) objStart = i;
      depthBrace++;
    } else if (ch === '}') {
      depthBrace--;
      if (depthBrace === 0 && depthBracket === 1 && objStart >= 0) {
        out.push(entryText.slice(objStart, i + 1));
        objStart = -1;
      }
    } else if (ch === '[') depthBracket++;
    else if (ch === ']') {
      depthBracket--;
      if (depthBracket === 0) break;
    }
  }
  return out;
}

/** Pluck a single string-valued field from an object literal text. */
function pluckString(obj: string, field: string): string | undefined {
  const re = new RegExp(`\\b${field}:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`);
  const m = re.exec(obj);
  return m ? m[2] : undefined;
}

function parseLinks(entryText: string): RawLink[] {
  const objs = extractArrayObjects(entryText, 'links');
  if (!objs) return [];
  return objs
    .map((o) => {
      const url = pluckString(o, 'url') ?? '';
      const label = pluckString(o, 'label') ?? '';
      const kind = pluckString(o, 'kind');
      const region = pluckString(o, 'region');
      return { label, url, kind, region };
    })
    .filter((l) => !!l.url);
}

function parseMediaImages(entryText: string): RawImage[] {
  const objs = extractArrayObjects(entryText, 'media.images');
  if (!objs) return [];
  return objs
    .map((o) => ({
      url: pluckString(o, 'url') ?? '',
      caption: pluckString(o, 'caption'),
      credit: pluckString(o, 'credit'),
      sourceUrl: pluckString(o, 'sourceUrl'),
    }))
    .filter((img) => !!img.url);
}

function hasField(entryText: string, field: string): boolean {
  // Looks for `<field>:` at any indentation. Sufficiently unique to
  // avoid false positives inside template literals because the field
  // names we check (philosophy, tendencies, etc.) are unlikely to
  // appear as keys inside narrative text.
  const re = new RegExp(`\\b${field}:`);
  return re.test(entryText);
}

// ── Link classification ──────────────────────────────────────────────

type LinkKind = 'official' | 'dealer' | 'affiliate' | 'used' | 'review' | 'unknown';

const AFFILIATE_HOSTS = new Set([
  'amazon.com',
  'amzn.to',
  'amzn.com',
]);
const USED_HOSTS = new Set([
  'ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it',
  'hifishark.com', 'audiogon.com', 'usaudiomart.com', 'reverb.com',
  'canuckaudiomart.com', 'audiomart.com',
]);
const REVIEW_HOSTS = new Set([
  'stereophile.com', '6moons.com', 'darko.audio', 'soundstageglobal.com',
  'soundstagehifi.com', 'positive-feedback.com', 'hifinews.com',
  'whathifi.com', 'parttimeaudiophile.com', 'audiosciencereview.com',
  'tonepublications.com', 'theabsolutesound.com', 'innerfidelity.com',
  'headphones.com', 'audiophilereview.com',
]);

function classifyLink(link: RawLink): LinkKind {
  if (link.kind === 'dealer') return 'dealer';
  if (link.kind === 'review') return 'review';
  if (link.kind === 'reference') return 'review';
  const host = safeHost(link.url);
  if (!host) return 'unknown';
  if (AFFILIATE_HOSTS.has(host) || host.endsWith('.amazon.com')) return 'affiliate';
  if (USED_HOSTS.has(host)) return 'used';
  if (REVIEW_HOSTS.has(host)) return 'review';
  const label = link.label.toLowerCase();
  if (label.includes('dealer') || label.includes('distributor') || label.includes('importer')) return 'dealer';
  if (label.includes('review')) return 'review';
  if (label.includes('used')) return 'used';
  if (label.includes('official') || label.includes('website') || label.includes('homepage')) return 'official';
  return 'official';
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ── HTTP probing ─────────────────────────────────────────────────────

interface ProbeResult {
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: number | null;
  error: string | null;
  durationMs: number;
}

const USER_AGENT =
  'AudioXX-AuditBot/1.0 (+https://audio-xx.com; integrity audit, read-only)';
const PROBE_TIMEOUT_MS = 15_000;

async function probeUrl(url: string): Promise<ProbeResult> {
  const start = Date.now();
  const baseResult = (extra: Partial<ProbeResult>): ProbeResult => ({
    url,
    ok: false,
    status: null,
    contentType: null,
    contentLength: null,
    error: null,
    durationMs: Date.now() - start,
    ...extra,
  });

  const doFetch = async (method: 'HEAD' | 'GET'): Promise<Response> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  };

  try {
    let res: Response;
    try {
      res = await doFetch('HEAD');
    } catch (err) {
      // Some hosts close the connection on HEAD — retry with GET.
      res = await doFetch('GET');
    }
    if (!res.ok && (res.status === 405 || res.status === 403)) {
      // HEAD often returns 405; try GET. Some hosts also return 403 on
      // HEAD with default UAs.
      try {
        res = await doFetch('GET');
      } catch (err) {
        return baseResult({
          error: (err as Error).message?.slice(0, 200) ?? 'unknown',
        });
      }
    }
    const ct = res.headers.get('content-type');
    const cl = res.headers.get('content-length');
    return baseResult({
      ok: res.ok,
      status: res.status,
      contentType: ct,
      contentLength: cl ? Number(cl) : null,
    });
  } catch (err) {
    return baseResult({
      error: (err as Error).message?.slice(0, 200) ?? 'unknown',
    });
  }
}

async function probeAllWithConcurrency(
  urls: string[],
  concurrency: number,
): Promise<Map<string, ProbeResult>> {
  const unique = Array.from(new Set(urls));
  const results = new Map<string, ProbeResult>();
  let nextIdx = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = nextIdx++;
      if (i >= unique.length) return;
      const url = unique[i];
      process.stdout.write(`  [${i + 1}/${unique.length}] probing ${url.slice(0, 80)}\n`);
      results.set(url, await probeUrl(url));
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── CSV helpers ──────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',') + '\n';
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Audio XX Manufacturer Integrity Audit — Phase 1 (data)');
  console.log(`  reading: ${CONSULTATION_PATH}`);
  const src = fs.readFileSync(CONSULTATION_PATH, 'utf-8');
  const { body, startLine } = extractBrandProfilesBody(src);
  const entries = splitTopLevelObjects(body);
  console.log(`  found ${entries.length} brand entries`);

  // ── Parse each entry ─────────────────────────────────
  const records: BrandRecord[] = [];
  const lineOfBodyStart = startLine; // line of `const BRAND_PROFILES = [`
  for (const { text, offset } of entries) {
    const names = extractNames(text);
    if (names.length === 0) continue;
    const primaryName = names[0];
    const slug = toSlug(primaryName);

    const blockStartLine =
      lineOfBodyStart + body.slice(0, offset).split('\n').length - 1;

    records.push({
      slug,
      primaryName,
      names,
      hasPhilosophy: hasField(text, 'philosophy'),
      hasPhilosophyExtended: hasField(text, 'philosophyExtended'),
      hasTendencies: hasField(text, 'tendencies'),
      hasSystemContext: hasField(text, 'systemContext'),
      hasPairingNotes: hasField(text, 'pairingNotes'),
      hasLeadershipOrigin: hasField(text, 'leadershipOrigin'),
      hasReviewerQuotes: hasField(text, 'reviewerQuotes'),
      hasStrengths: hasField(text, 'strengths'),
      hasTradeoffs: hasField(text, 'tradeoffs'),
      hasDesignFamilies: hasField(text, 'designFamilies'),
      hasTagline: hasField(text, 'tagline'),
      hasDesignPhilosophy: hasField(text, 'designPhilosophy'),
      hasSonicTendency: hasField(text, 'sonicTendency'),
      hasTypicalTradeoff: hasField(text, 'typicalTradeoff'),
      hasRepresentativeImageUrl: hasField(text, 'representativeImageUrl'),
      hasLogoUrl: hasField(text, 'logoUrl'),
      hasSecondaryImageUrl: hasField(text, 'secondaryImageUrl'),
      links: parseLinks(text),
      mediaImages: parseMediaImages(text),
      blockStartLine,
    });
  }
  console.log(`  parsed ${records.length} valid brand records`);

  // ── Duplicate-alias detection ──────────────────────
  const aliasOwners = new Map<string, string[]>();
  for (const r of records) {
    for (const n of r.names) {
      const key = n.toLowerCase().trim();
      const arr = aliasOwners.get(key) ?? [];
      arr.push(r.slug);
      aliasOwners.set(key, arr);
    }
  }
  const dupes: { alias: string; brands: string[] }[] = [];
  for (const [alias, slugs] of aliasOwners) {
    if (slugs.length > 1) dupes.push({ alias, brands: slugs });
  }

  // ── Collect every URL to probe ─────────────────────
  const urls: string[] = [];
  for (const r of records) {
    for (const l of r.links) urls.push(l.url);
    for (const img of r.mediaImages) {
      urls.push(img.url);
      if (img.sourceUrl) urls.push(img.sourceUrl);
    }
  }
  console.log(`  probing ${new Set(urls).size} unique URLs (concurrency=8)...`);
  const probeResults = await probeAllWithConcurrency(urls, 8);

  // ── Build per-brand JSON ───────────────────────────
  type BrandAuditRecord = ReturnType<typeof toBrandAudit>;
  function toBrandAudit(r: BrandRecord) {
    const linkClassified = r.links.map((l) => {
      const probe = probeResults.get(l.url);
      return {
        label: l.label,
        url: l.url,
        declaredKind: l.kind,
        region: l.region,
        classified: classifyLink(l),
        probeStatus: probe?.status ?? null,
        probeOk: probe?.ok ?? false,
        probeContentType: probe?.contentType ?? null,
        probeError: probe?.error ?? null,
      };
    });
    const imageProbes = r.mediaImages.map((img) => {
      const probe = probeResults.get(img.url);
      const looksLikeImage = !!probe?.contentType && /^image\//i.test(probe.contentType);
      return {
        url: img.url,
        caption: img.caption ?? null,
        credit: img.credit ?? null,
        sourceUrl: img.sourceUrl ?? null,
        probeStatus: probe?.status ?? null,
        probeOk: probe?.ok ?? false,
        probeContentType: probe?.contentType ?? null,
        looksLikeImage,
        probeContentLength: probe?.contentLength ?? null,
        probeError: probe?.error ?? null,
      };
    });
    const fieldCompleteness = [
      r.hasPhilosophy, r.hasPhilosophyExtended, r.hasTendencies,
      r.hasSystemContext, r.hasPairingNotes, r.hasLeadershipOrigin,
      r.hasReviewerQuotes, r.hasStrengths, r.hasTradeoffs,
      r.hasDesignFamilies, r.hasTagline, r.hasDesignPhilosophy,
      r.hasSonicTendency, r.hasTypicalTradeoff,
    ].filter(Boolean).length;
    const TOTAL_TRACKED_FIELDS = 14;
    return {
      slug: r.slug,
      primaryName: r.primaryName,
      aliases: r.names,
      routeUrl: `/brand/${r.slug}`,
      blockStartLine: r.blockStartLine,
      fieldCompleteness: { populated: fieldCompleteness, total: TOTAL_TRACKED_FIELDS },
      flags: {
        noImages: imageProbes.length === 0,
        anyImageBroken: imageProbes.some((p) => !p.probeOk || !p.looksLikeImage),
        anyLinkBroken: linkClassified.some((l) => !l.probeOk),
        missingPairingNotes: !r.hasPairingNotes,
        missingTagline: !r.hasTagline,
        missingReviewerQuotes: !r.hasReviewerQuotes,
        missingDesignFamilies: !r.hasDesignFamilies,
      },
      images: imageProbes,
      links: linkClassified,
    };
  }

  const brandAudits: BrandAuditRecord[] = records.map(toBrandAudit);

  // ── Compute risk score (for ranking) ───────────────
  function risk(b: BrandAuditRecord): number {
    let r = 0;
    if (b.flags.noImages) r += 5;
    if (b.flags.anyImageBroken) r += 4;
    if (b.flags.anyLinkBroken) r += 3;
    if (b.flags.missingPairingNotes) r += 1;
    if (b.flags.missingTagline) r += 1;
    if (b.flags.missingReviewerQuotes) r += 1;
    if (b.flags.missingDesignFamilies) r += 1;
    r += 14 - b.fieldCompleteness.populated;
    return r;
  }
  const ranked = [...brandAudits]
    .map((b) => ({ b, r: risk(b) }))
    .sort((a, b) => b.r - a.r);

  // ── Write outputs ──────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. manufacturer-audit.json
  fs.writeFileSync(
    path.join(OUT_DIR, 'manufacturer-audit.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scriptVersion: 'audit-manufacturers.ts@1',
        brandCount: brandAudits.length,
        brands: brandAudits,
        topRisk: ranked.slice(0, 15).map(({ b, r }) => ({
          slug: b.slug,
          riskScore: r,
          flags: b.flags,
        })),
      },
      null,
      2,
    ),
  );

  // 2. manufacturer-link-report.csv
  let linkCsv = csvRow([
    'brand_slug', 'brand_primary_name', 'link_label', 'link_url',
    'classified_kind', 'declared_kind', 'region',
    'probe_status', 'probe_ok', 'probe_content_type', 'probe_error',
  ]);
  for (const b of brandAudits) {
    for (const l of b.links) {
      linkCsv += csvRow([
        b.slug, b.primaryName, l.label, l.url,
        l.classified, l.declaredKind ?? '', l.region ?? '',
        l.probeStatus ?? '', l.probeOk, l.probeContentType ?? '',
        l.probeError ?? '',
      ]);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manufacturer-link-report.csv'), linkCsv);

  // 3. missing-images.csv
  let missingCsv = csvRow([
    'brand_slug', 'brand_primary_name', 'issue', 'image_url',
    'probe_status', 'probe_content_type', 'probe_error',
  ]);
  for (const b of brandAudits) {
    if (b.images.length === 0) {
      missingCsv += csvRow([
        b.slug, b.primaryName, 'no_images_declared', '', '', '', '',
      ]);
      continue;
    }
    for (const img of b.images) {
      if (!img.probeOk) {
        missingCsv += csvRow([
          b.slug, b.primaryName, 'image_probe_failed', img.url,
          img.probeStatus ?? '', img.probeContentType ?? '',
          img.probeError ?? '',
        ]);
      } else if (!img.looksLikeImage) {
        missingCsv += csvRow([
          b.slug, b.primaryName, 'not_image_content_type', img.url,
          img.probeStatus ?? '', img.probeContentType ?? '',
          img.probeError ?? '',
        ]);
      }
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'missing-images.csv'), missingCsv);

  // 4. dead-links.csv
  let deadCsv = csvRow([
    'brand_slug', 'brand_primary_name', 'kind', 'url',
    'probe_status', 'probe_content_type', 'probe_error',
  ]);
  for (const b of brandAudits) {
    for (const l of b.links) {
      if (!l.probeOk) {
        deadCsv += csvRow([
          b.slug, b.primaryName, l.classified, l.url,
          l.probeStatus ?? '', l.probeContentType ?? '',
          l.probeError ?? '',
        ]);
      }
    }
    for (const img of b.images) {
      if (!img.probeOk) {
        deadCsv += csvRow([
          b.slug, b.primaryName, 'image', img.url,
          img.probeStatus ?? '', img.probeContentType ?? '',
          img.probeError ?? '',
        ]);
      }
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'dead-links.csv'), deadCsv);

  // 5. duplicate-aliases.csv
  let dupCsv = csvRow(['alias', 'brands']);
  for (const d of dupes) {
    dupCsv += csvRow([d.alias, d.brands.join(' | ')]);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'duplicate-aliases.csv'), dupCsv);

  // ── Summary to console ─────────────────────────────
  console.log('\nSummary:');
  console.log(`  brands audited:           ${brandAudits.length}`);
  console.log(`  unique URLs probed:       ${new Set(urls).size}`);
  console.log(`  brands with no images:    ${brandAudits.filter((b) => b.flags.noImages).length}`);
  console.log(`  brands with broken image: ${brandAudits.filter((b) => b.flags.anyImageBroken).length}`);
  console.log(`  brands with broken link:  ${brandAudits.filter((b) => b.flags.anyLinkBroken).length}`);
  console.log(`  duplicate aliases:        ${dupes.length}`);
  console.log(`\nTop-10 highest risk:`);
  for (const { b, r } of ranked.slice(0, 10)) {
    const flagBits = Object.entries(b.flags)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    console.log(`  [${String(r).padStart(2)}] ${b.slug.padEnd(22)} ${flagBits}`);
  }
  console.log(`\nWrote 5 files to ${path.relative(REPO_ROOT, OUT_DIR)}/`);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exitCode = 1;
});
