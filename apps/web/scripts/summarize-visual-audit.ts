/**
 * Audio XX — Manufacturer Visual Audit summarizer.
 *
 * Reads the per-(brand, viewport) JSON sidecars produced by
 * src/tests/manufacturer-visual-audit.spec.ts and:
 *
 *   - merges every viewport into a single visual-audit-summary.json
 *   - builds HTML contact sheets at desktop and mobile (one page each,
 *     CSS grid of brand screenshots with name + flag chips)
 *   - writes screenshot-index.md (markdown table of every brand,
 *     linking the desktop + mobile screenshot and noting flags)
 *   - writes visual-failure-notes.md (focused report on real failures:
 *     mobile overflow, broken images, console errors, page errors)
 *
 * Read-only with respect to the application — outputs live under
 * audit-2026-05-21/manufacturer-integrity/visual/.
 *
 * Run from any cwd:
 *   cd apps/web
 *   npx tsx scripts/summarize-visual-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const APPS_WEB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APPS_WEB_ROOT, '..', '..');
const AUDIT_ROOT = path.join(REPO_ROOT, 'audit-2026-05-21', 'manufacturer-integrity');
const VISUAL_ROOT = path.join(AUDIT_ROOT, 'visual');
const DIAG_DIR = path.join(VISUAL_ROOT, 'diagnostics');

interface ImageDiag {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  visible: boolean;
  alt: string | null;
  broken: boolean;
}

interface FailedRequest {
  url: string;
  method: string;
  failure: string | null;
  resourceType: string;
}

interface PerViewportDiag {
  slug: string;
  primaryName: string;
  viewport: 'desktop' | 'mobile';
  viewportWidth: number;
  viewportHeight: number;
  routeUrl: string;
  httpStatus: number | null;
  pageTitle: string;
  scrollWidth: number;
  clientWidth: number;
  overflowX: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  images: ImageDiag[];
  brokenImageCount: number;
  outboundLinkCount: number;
  outboundLinkHosts: Record<string, number>;
  screenshotPath: string;
}

function loadSidecars(): PerViewportDiag[] {
  if (!fs.existsSync(DIAG_DIR)) {
    throw new Error(`No diagnostics dir at ${DIAG_DIR} — run the spec first`);
  }
  const files = fs.readdirSync(DIAG_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(DIAG_DIR, f), 'utf-8')) as PerViewportDiag,
  );
}

interface MergedBrand {
  slug: string;
  primaryName: string;
  routeUrl: string;
  desktop?: PerViewportDiag;
  mobile?: PerViewportDiag;
}

function mergeBySlug(sidecars: PerViewportDiag[]): MergedBrand[] {
  const map = new Map<string, MergedBrand>();
  for (const s of sidecars) {
    const cur = map.get(s.slug) ?? {
      slug: s.slug,
      primaryName: s.primaryName,
      routeUrl: s.routeUrl,
    };
    cur[s.viewport] = s;
    map.set(s.slug, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

function brandFlags(brand: MergedBrand): string[] {
  const flags: string[] = [];
  for (const vp of ['desktop', 'mobile'] as const) {
    const d = brand[vp];
    if (!d) continue;
    if (d.brokenImageCount > 0) flags.push(`${vp}:broken-image(${d.brokenImageCount})`);
    if (d.overflowX) flags.push(`${vp}:overflow-x(${d.scrollWidth}>${d.clientWidth})`);
    if (d.consoleErrors.length > 0) flags.push(`${vp}:console-errors(${d.consoleErrors.length})`);
    if (d.pageErrors.length > 0) flags.push(`${vp}:page-errors(${d.pageErrors.length})`);
    if (d.failedRequests.length > 0) flags.push(`${vp}:net-failures(${d.failedRequests.length})`);
    if (d.images.length === 0) flags.push(`${vp}:no-images`);
  }
  return flags;
}

function buildContactSheet(
  brands: MergedBrand[],
  viewport: 'desktop' | 'mobile',
): string {
  const cardWidthPx = viewport === 'desktop' ? 360 : 240;
  const cardMaxHeightPx = viewport === 'desktop' ? 260 : 360;
  const html: string[] = [];
  html.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Audio XX — Manufacturer visual contact sheet (${viewport})</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 24px; background: #FBFAF7; color: #1F1D1B; }
  h1 { font-size: 1.2rem; margin: 0 0 0.5rem; font-weight: 700; letter-spacing: -0.012em; }
  .meta { color: #5C5852; font-size: 0.85rem; margin-bottom: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(${cardWidthPx}px, 1fr)); gap: 18px; }
  .card { border: 1px solid #D8D2C5; border-radius: 8px; overflow: hidden; background: #FFFEFA; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; }
  .card a { color: inherit; text-decoration: none; }
  .imgwrap { background: #F5F3EE; max-height: ${cardMaxHeightPx}px; overflow: hidden; border-bottom: 1px solid #E8E3D7; }
  .imgwrap img { width: 100%; height: auto; display: block; }
  .label { padding: 10px 12px; font-size: 0.92rem; font-weight: 600; }
  .slug { font-family: ui-monospace, SFMono-Regular, "SF Mono", monospace; font-size: 0.7rem; color: #8C877F; text-transform: lowercase; }
  .flags { padding: 0 12px 12px; font-size: 0.7rem; color: #8C877F; }
  .flag { display: inline-block; background: #F5F3EE; padding: 2px 6px; border-radius: 3px; margin: 2px 4px 2px 0; }
  .flag.warn { background: #F8E8D8; color: #8B5A20; }
  .flag.err { background: #FAE0DC; color: #8A2818; }
</style>
</head>
<body>
<h1>Audio XX — Manufacturer Contact Sheet (${viewport})</h1>
<div class="meta">${brands.length} brand pages · generated ${new Date().toISOString()} · screenshots are <code>${viewport}/&lt;slug&gt;.png</code></div>
<div class="grid">`);

  for (const b of brands) {
    const d = b[viewport];
    if (!d) continue;
    const relSrc = `${viewport}/${b.slug}.png`;
    const flagBits: { text: string; cls: 'warn' | 'err' | '' }[] = [];
    if (d.brokenImageCount > 0) flagBits.push({ text: `broken-image×${d.brokenImageCount}`, cls: 'err' });
    if (d.overflowX) flagBits.push({ text: `overflow-x ${d.scrollWidth}>${d.clientWidth}`, cls: 'err' });
    if (d.consoleErrors.length > 0) flagBits.push({ text: `console-err×${d.consoleErrors.length}`, cls: 'warn' });
    if (d.pageErrors.length > 0) flagBits.push({ text: `page-err×${d.pageErrors.length}`, cls: 'err' });
    if (d.failedRequests.length > 0) flagBits.push({ text: `net-fail×${d.failedRequests.length}`, cls: 'warn' });
    if (d.images.length === 0) flagBits.push({ text: 'no-images', cls: 'warn' });
    if (d.outboundLinkCount === 0) flagBits.push({ text: 'no-outbound-links', cls: 'warn' });

    html.push(`<div class="card">
  <a href="${relSrc}" target="_blank" rel="noopener">
    <div class="imgwrap"><img src="${relSrc}" alt="${escapeAttr(b.primaryName)}" loading="lazy"></div>
  </a>
  <div class="label">${escapeText(b.primaryName)} <span class="slug">/brand/${b.slug}</span></div>
  ${flagBits.length > 0
    ? `<div class="flags">${flagBits.map((f) => `<span class="flag ${f.cls}">${escapeText(f.text)}</span>`).join('')}</div>`
    : ''}
</div>`);
  }
  html.push('</div></body></html>');
  return html.join('\n');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

function buildScreenshotIndexMd(brands: MergedBrand[]): string {
  const lines: string[] = [];
  lines.push(`# Manufacturer screenshot index\n`);
  lines.push(`Generated ${new Date().toISOString()} · ${brands.length} brands × 2 viewports = ${brands.length * 2} screenshots.\n`);
  lines.push(`Contact sheets (open in browser):`);
  lines.push(`- [Desktop contact sheet](contact-sheet-desktop.html)`);
  lines.push(`- [Mobile contact sheet](contact-sheet-mobile.html)\n`);
  lines.push(`| Brand | Slug | Desktop | Mobile | Flags |`);
  lines.push(`|---|---|---|---|---|`);
  for (const b of brands) {
    const dSh = b.desktop ? `[png](desktop/${b.slug}.png)` : '—';
    const mSh = b.mobile ? `[png](mobile/${b.slug}.png)` : '—';
    const flags = brandFlags(b).join(' · ') || '✓';
    lines.push(`| ${b.primaryName} | \`${b.slug}\` | ${dSh} | ${mSh} | ${flags} |`);
  }
  return lines.join('\n') + '\n';
}

function buildFailureNotes(brands: MergedBrand[]): string {
  const lines: string[] = [];
  lines.push(`# Visual audit — failure notes\n`);
  lines.push(`Generated ${new Date().toISOString()}\n`);
  lines.push(`Categories below list only brands that fired the named flag. Brands with no entries under a category are clean for that check.\n`);

  // 1. Broken images (per-viewport, with the failing src list)
  lines.push(`## Broken images (\`img.naturalWidth === 0\` after load)\n`);
  const brokenBrands = brands.filter((b) =>
    (b.desktop?.brokenImageCount ?? 0) > 0 || (b.mobile?.brokenImageCount ?? 0) > 0,
  );
  if (brokenBrands.length === 0) {
    lines.push(`_None._\n`);
  } else {
    for (const b of brokenBrands) {
      lines.push(`### ${b.primaryName} (\`/brand/${b.slug}\`)`);
      for (const vp of ['desktop', 'mobile'] as const) {
        const d = b[vp];
        if (!d) continue;
        const broken = d.images.filter((i) => i.broken);
        if (broken.length === 0) continue;
        lines.push(`- **${vp}**:`);
        for (const img of broken) {
          lines.push(`  - \`${img.src}\`${img.alt ? ` — alt: "${img.alt}"` : ''}`);
        }
      }
      lines.push('');
    }
  }

  // 2. Mobile horizontal overflow
  lines.push(`## Mobile horizontal overflow (\`scrollWidth > clientWidth + 1\`)\n`);
  const overflow = brands.filter((b) => b.mobile?.overflowX);
  if (overflow.length === 0) {
    lines.push(`_None._\n`);
  } else {
    lines.push(`| Brand | scrollWidth | clientWidth |\n|---|---|---|`);
    for (const b of overflow) {
      lines.push(`| ${b.primaryName} | ${b.mobile!.scrollWidth} | ${b.mobile!.clientWidth} |`);
    }
    lines.push('');
  }

  // 3. Desktop overflow (rare but worth flagging)
  lines.push(`## Desktop horizontal overflow\n`);
  const dOverflow = brands.filter((b) => b.desktop?.overflowX);
  if (dOverflow.length === 0) lines.push(`_None._\n`);
  else {
    lines.push(`| Brand | scrollWidth | clientWidth |\n|---|---|---|`);
    for (const b of dOverflow) {
      lines.push(`| ${b.primaryName} | ${b.desktop!.scrollWidth} | ${b.desktop!.clientWidth} |`);
    }
    lines.push('');
  }

  // 4. Console errors
  lines.push(`## Console errors\n`);
  const consoleBrands = brands.filter((b) =>
    (b.desktop?.consoleErrors.length ?? 0) > 0 || (b.mobile?.consoleErrors.length ?? 0) > 0,
  );
  if (consoleBrands.length === 0) lines.push(`_None._\n`);
  else {
    for (const b of consoleBrands) {
      lines.push(`### ${b.primaryName}`);
      for (const vp of ['desktop', 'mobile'] as const) {
        const errs = b[vp]?.consoleErrors ?? [];
        if (errs.length === 0) continue;
        lines.push(`- **${vp}**:`);
        for (const e of errs.slice(0, 5)) {
          lines.push(`  - ${e.slice(0, 220)}`);
        }
        if (errs.length > 5) lines.push(`  - … +${errs.length - 5} more`);
      }
      lines.push('');
    }
  }

  // 5. Page errors (uncaught exceptions)
  lines.push(`## Page errors (uncaught exceptions)\n`);
  const pageErrBrands = brands.filter((b) =>
    (b.desktop?.pageErrors.length ?? 0) > 0 || (b.mobile?.pageErrors.length ?? 0) > 0,
  );
  if (pageErrBrands.length === 0) lines.push(`_None._\n`);
  else {
    for (const b of pageErrBrands) {
      lines.push(`### ${b.primaryName}`);
      for (const vp of ['desktop', 'mobile'] as const) {
        const errs = b[vp]?.pageErrors ?? [];
        if (errs.length === 0) continue;
        lines.push(`- **${vp}**: ${errs.join(' | ').slice(0, 400)}`);
      }
      lines.push('');
    }
  }

  // 6. Network failures
  lines.push(`## Failed network requests\n`);
  const netBrands = brands.filter((b) =>
    (b.desktop?.failedRequests.length ?? 0) > 0 || (b.mobile?.failedRequests.length ?? 0) > 0,
  );
  if (netBrands.length === 0) lines.push(`_None._\n`);
  else {
    for (const b of netBrands) {
      lines.push(`### ${b.primaryName}`);
      for (const vp of ['desktop', 'mobile'] as const) {
        const reqs = b[vp]?.failedRequests ?? [];
        if (reqs.length === 0) continue;
        lines.push(`- **${vp}**:`);
        for (const r of reqs.slice(0, 8)) {
          lines.push(`  - [${r.resourceType}] ${r.url.slice(0, 110)} — ${r.failure ?? 'unknown failure'}`);
        }
        if (reqs.length > 8) lines.push(`  - … +${reqs.length - 8} more`);
      }
      lines.push('');
    }
  }

  // 7. Brands with no visible images at all (after-load state)
  lines.push(`## Brands rendering with zero visible images\n`);
  const noVisible = brands.filter((b) => {
    const allImgs = [...(b.desktop?.images ?? []), ...(b.mobile?.images ?? [])];
    if (allImgs.length === 0) return true;
    const anyVisible = allImgs.some((i) => i.visible && !i.broken && i.naturalWidth > 0);
    return !anyVisible;
  });
  if (noVisible.length === 0) lines.push(`_None._\n`);
  else {
    lines.push(`These brand pages render with no working image in either viewport — empty hero band.\n`);
    lines.push(`| Brand | Slug |\n|---|---|`);
    for (const b of noVisible) lines.push(`| ${b.primaryName} | \`${b.slug}\` |`);
    lines.push('');
  }

  return lines.join('\n');
}

function main(): void {
  const sidecars = loadSidecars();
  const brands = mergeBySlug(sidecars);
  console.log(`Loaded ${sidecars.length} diagnostic files → ${brands.length} brands`);

  fs.writeFileSync(
    path.join(VISUAL_ROOT, 'visual-audit-summary.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), brandCount: brands.length, brands },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(VISUAL_ROOT, 'contact-sheet-desktop.html'), buildContactSheet(brands, 'desktop'));
  fs.writeFileSync(path.join(VISUAL_ROOT, 'contact-sheet-mobile.html'), buildContactSheet(brands, 'mobile'));
  fs.writeFileSync(path.join(VISUAL_ROOT, 'screenshot-index.md'), buildScreenshotIndexMd(brands));
  fs.writeFileSync(path.join(VISUAL_ROOT, 'visual-failure-notes.md'), buildFailureNotes(brands));

  console.log('\nWrote:');
  console.log(`  ${path.relative(REPO_ROOT, VISUAL_ROOT)}/visual-audit-summary.json`);
  console.log(`  ${path.relative(REPO_ROOT, VISUAL_ROOT)}/contact-sheet-desktop.html`);
  console.log(`  ${path.relative(REPO_ROOT, VISUAL_ROOT)}/contact-sheet-mobile.html`);
  console.log(`  ${path.relative(REPO_ROOT, VISUAL_ROOT)}/screenshot-index.md`);
  console.log(`  ${path.relative(REPO_ROOT, VISUAL_ROOT)}/visual-failure-notes.md`);

  // Quick counts to stdout
  let totalBrokenImages = 0;
  let mobileOverflow = 0;
  let consoleErrs = 0;
  let pageErrs = 0;
  let netFails = 0;
  let zeroVisibleHero = 0;
  for (const b of brands) {
    totalBrokenImages += (b.desktop?.brokenImageCount ?? 0) + (b.mobile?.brokenImageCount ?? 0);
    if (b.mobile?.overflowX) mobileOverflow++;
    consoleErrs += (b.desktop?.consoleErrors.length ?? 0) + (b.mobile?.consoleErrors.length ?? 0);
    pageErrs += (b.desktop?.pageErrors.length ?? 0) + (b.mobile?.pageErrors.length ?? 0);
    netFails += (b.desktop?.failedRequests.length ?? 0) + (b.mobile?.failedRequests.length ?? 0);
    const allImgs = [...(b.desktop?.images ?? []), ...(b.mobile?.images ?? [])];
    if (allImgs.length === 0 || !allImgs.some((i) => i.visible && !i.broken && i.naturalWidth > 0)) zeroVisibleHero++;
  }
  console.log('\nFailure counts:');
  console.log(`  total broken <img>:          ${totalBrokenImages}`);
  console.log(`  brands w/ mobile overflow:   ${mobileOverflow}`);
  console.log(`  brands w/ zero visible hero: ${zeroVisibleHero}`);
  console.log(`  total console errors:        ${consoleErrs}`);
  console.log(`  total page errors:           ${pageErrs}`);
  console.log(`  total failed requests:       ${netFails}`);
}

main();
