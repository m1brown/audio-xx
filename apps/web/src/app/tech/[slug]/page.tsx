import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findBrandProfileBySlug, type BrandProfile } from '@/lib/consultation';
import {
  findTechnologyProfileBySlug,
  type TechnologyCrossLink,
} from '@/lib/technology-profiles';
import { toSlug as routeToSlug } from '@/lib/route-slug';
import { COLOR, sectionHeadingStyle, proseStyle } from '@/lib/editorial-tokens';

/**
 * Audio XX — Technology authority page.
 *
 * Full editorial argument for a topology, approach, or school-of-design.
 * Sister to the Brand Authority page (apps/web/src/app/brand/[slug]/page.tsx).
 *
 * Sections (when source fields exist; absent sections are silently
 * suppressed):
 *
 *   1. Hero — display name, tagline, optional image
 *   2. Quick Identity — schoolsMemo as a single-paragraph orientation
 *   3. What It Is — technical anchor
 *   4. Why It Matters — structural claim
 *   5. What It Gives — strengths bullets
 *   6. What It Costs — tradeoffs bullets
 *   7. Philosophy / Why Listeners Still Choose This — philosophy +
 *      philosophyExtended prose
 *   8. System Fit — pairing-compatibility paragraph
 *   9. Related Brands — cross-link cards into /brand/[slug] pages
 *  10. Related Technologies — cross-link cards into sibling /tech/[slug] pages
 *  11. Further Reading / Links — informational external references
 *
 * All content sourced verbatim from TechnologyProfile. No editorial
 * invention by the renderer. Cross-link card content (target name +
 * tagline + relation sentence) is resolved at request time from
 * BRAND_PROFILES / TECHNOLOGY_PROFILES so the cards reflect current
 * brand prose; if a slug fails to resolve, the card is suppressed
 * silently (a dev-only console.warn surfaces the drift).
 */

// ── Design tokens ───────────────────────────────────────
// Same source of truth as the Brand Authority page. The tokens module
// is locked by apps/web/src/lib/__tests__/editorial-tokens.test.ts to
// prevent silent drift.

// ── Schools-memo orientation paragraph helper ─────────────

function pickQuickIdentityProse(opts: {
  schoolsMemo?: string;
  tagline?: string;
  philosophyLede?: string;
}): string | null {
  if (opts.schoolsMemo && opts.schoolsMemo.trim()) return opts.schoolsMemo;
  if (opts.tagline && opts.tagline.trim()) return opts.tagline;
  if (opts.philosophyLede && opts.philosophyLede.trim()) return opts.philosophyLede;
  return null;
}

function firstSentence(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/^[^.!?]+[.!?]/);
  return m ? m[0] : s;
}

// ── Cross-link resolution ──────────────────────────────────

interface ResolvedBrandLink {
  link: TechnologyCrossLink;
  brand: BrandProfile;
  brandSlug: string;
  brandDisplayName: string;
}

function resolveBrandLinks(links: TechnologyCrossLink[]): ResolvedBrandLink[] {
  const resolved: ResolvedBrandLink[] = [];
  for (const link of links) {
    const brand = findBrandProfileBySlug(link.slug);
    if (!brand) {
      // Silent in prod; visible in dev. Authoring drift (renamed alias,
      // typo in slug) will show in the dev-server console.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
          `[tech-page] relatedBrandSlugs entry '${link.slug}' did not resolve to a BrandProfile; card suppressed.`,
        );
      }
      continue;
    }
    const displayName =
      brand.displayName ?? brand.names[0] ?? link.slug;
    resolved.push({ link, brand, brandSlug: link.slug, brandDisplayName: displayName });
  }
  return resolved;
}

interface ResolvedTechLink {
  link: TechnologyCrossLink;
  techSlug: string;
  techDisplayName: string;
  tagline: string | undefined;
}

function resolveTechnologyLinks(
  links: TechnologyCrossLink[] | undefined,
): ResolvedTechLink[] {
  if (!links) return [];
  const resolved: ResolvedTechLink[] = [];
  for (const link of links) {
    const tp = findTechnologyProfileBySlug(link.slug);
    if (!tp) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
          `[tech-page] relatedTechnologySlugs entry '${link.slug}' did not resolve to a TechnologyProfile; card suppressed.`,
        );
      }
      continue;
    }
    resolved.push({
      link,
      techSlug: routeToSlug(tp.names[0]),
      techDisplayName: tp.displayName,
      tagline: tp.tagline,
    });
  }
  return resolved;
}

// ── Page ─────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TechnologyPage({ params }: PageProps) {
  const { slug } = await params;
  const tp = findTechnologyProfileBySlug(slug);

  if (!tp) {
    // Clean 404 — no fallback for tech pages. Without a TechnologyProfile
    // entry the page has nothing to say and we do not invent content.
    notFound();
  }

  const displayName = tp.displayName;

  // Section visibility gates
  const quickIdentityProse = pickQuickIdentityProse({
    schoolsMemo: tp.schoolsMemo,
    tagline: tp.tagline,
    philosophyLede: firstSentence(tp.philosophy),
  });
  const hasQuickIdentity = !!quickIdentityProse;
  const hasWhatItIs = !!tp.whatItIs;
  const hasWhyItMatters = !!tp.whyItMatters;
  const hasStrengths = tp.strengths && tp.strengths.length > 0;
  const hasTradeoffs = tp.tradeoffs && tp.tradeoffs.length > 0;
  const hasPhilosophy = !!tp.philosophy;
  const hasPhilosophyExtended = !!tp.philosophyExtended;
  const hasSystemFit = !!tp.systemFit;

  const resolvedBrands = resolveBrandLinks(tp.relatedBrandSlugs);
  const hasRelatedBrands = resolvedBrands.length > 0;

  const resolvedTechs = resolveTechnologyLinks(tp.relatedTechnologySlugs);
  const hasRelatedTechs = resolvedTechs.length > 0;

  // Mirror brand page: filter out F4 'review' kind links even though
  // technology pages do not currently carry reviewer-source links.
  const safeLinks = (tp.links ?? []).filter((l) => l.kind !== 'review');
  const hasLinks = safeLinks.length > 0;

  // Hero image (single image; Technology Pages do not currently use the
  // two-up pattern from brand heritage pages)
  const heroImage = tp.media?.images?.[0] ?? null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
      {/* ── Back link ── */}
      <p style={{ fontSize: '0.82rem', color: COLOR.textMuted, marginBottom: '1.25rem' }}>
        <Link href="/" style={{ color: COLOR.textMuted }}>&larr; Back</Link>
      </p>

      {/* ══════════════════════════════════════════════════
          1. HERO — display name, tagline, optional image
         ══════════════════════════════════════════════════ */}
      <header style={{ marginBottom: '1.75rem' }}>
        {heroImage && (
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}>
            <figure style={{ flex: '1 1 100%', margin: 0 }}>
              <div style={{
                maxHeight: '340px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem 0',
              }}>
                <img
                  src={heroImage.url}
                  alt={heroImage.caption ?? displayName}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }}
                />
              </div>
              {heroImage.credit && (
                <figcaption style={{
                  marginTop: '0.2rem',
                  fontSize: '0.72rem',
                  color: COLOR.textMuted,
                  textAlign: 'right',
                }}>
                  Image:{' '}
                  {heroImage.sourceUrl ? (
                    <a href={heroImage.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: COLOR.textMuted, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                      {heroImage.credit}
                    </a>
                  ) : heroImage.credit}
                </figcaption>
              )}
            </figure>
          </div>
        )}

        <p style={{
          fontSize: '0.72rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLOR.textMuted,
          margin: '0 0 0.4rem',
        }}>
          Audio XX · Technology
        </p>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: COLOR.textPrimary,
          margin: 0,
          lineHeight: 1.2,
        }}>
          {displayName}
        </h1>
        {tp.tagline && (
          <p style={{
            margin: '0.35rem 0 0',
            fontSize: '1.05rem',
            color: COLOR.textSecondary,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {tp.tagline}
          </p>
        )}
      </header>

      {/* ══════════════════════════════════════════════════
          2. QUICK IDENTITY — schoolsMemo orientation
         ══════════════════════════════════════════════════ */}
      {hasQuickIdentity && (
        <section style={{
          background: COLOR.cardBg,
          border: `1px solid ${COLOR.border}`,
          borderRadius: '8px',
          padding: '1rem 1.1rem',
          margin: '0 0 1.75rem',
        }}>
          <p style={{ ...proseStyle, margin: 0 }}>{quickIdentityProse}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          3. WHAT IT IS
         ══════════════════════════════════════════════════ */}
      {hasWhatItIs && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>What It Is</h2>
          <p style={proseStyle}>{tp.whatItIs}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          4. WHY IT MATTERS
         ══════════════════════════════════════════════════ */}
      {hasWhyItMatters && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>Why It Matters</h2>
          <p style={proseStyle}>{tp.whyItMatters}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          5. WHAT IT GIVES — strengths (idea-gifts)
         ══════════════════════════════════════════════════ */}
      {hasStrengths && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>What It Gives</h2>
          <ul style={{ ...proseStyle, paddingLeft: '1.25rem', margin: 0 }}>
            {tp.strengths.map((s, i) => (
              <li key={i} style={{ marginBottom: '0.4rem' }}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          6. WHAT IT COSTS — tradeoffs (idea-costs)
         ══════════════════════════════════════════════════ */}
      {hasTradeoffs && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>What It Costs</h2>
          <ul style={{ ...proseStyle, paddingLeft: '1.25rem', margin: 0 }}>
            {tp.tradeoffs.map((s, i) => (
              <li key={i} style={{ marginBottom: '0.4rem' }}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          7. PHILOSOPHY / WHY LISTENERS STILL CHOOSE THIS
             — philosophy + philosophyExtended prose
         ══════════════════════════════════════════════════ */}
      {(hasPhilosophy || hasPhilosophyExtended) && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>Why Listeners Still Choose This</h2>
          {hasPhilosophy && <p style={proseStyle}>{tp.philosophy}</p>}
          {hasPhilosophyExtended && (
            <p style={{ ...proseStyle, marginTop: '0.75rem' }}>{tp.philosophyExtended}</p>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          8. SYSTEM FIT — idea-compatibility
         ══════════════════════════════════════════════════ */}
      {hasSystemFit && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>System Fit</h2>
          <p style={proseStyle}>{tp.systemFit}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          9. RELATED BRANDS — cross-link cards into /brand/[slug]
         ══════════════════════════════════════════════════ */}
      {hasRelatedBrands && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>Related Brands</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {resolvedBrands.map((rb) => (
              <Link
                key={rb.brandSlug}
                href={`/brand/${rb.brandSlug}`}
                style={{
                  display: 'block',
                  background: COLOR.cardBg,
                  border: `1px solid ${COLOR.border}`,
                  borderRadius: '8px',
                  padding: '0.9rem 1rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <p style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.01em',
                  color: COLOR.textPrimary,
                }}>
                  {rb.brandDisplayName}
                </p>
                {rb.brand.tagline && (
                  <p style={{
                    margin: '0.2rem 0 0',
                    fontSize: '0.82rem',
                    color: COLOR.textSecondary,
                    fontStyle: 'italic',
                  }}>
                    {rb.brand.tagline}
                  </p>
                )}
                <p style={{
                  margin: '0.55rem 0 0',
                  fontSize: '0.88rem',
                  color: COLOR.textPrimary,
                  lineHeight: 1.45,
                }}>
                  {rb.link.relation}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          10. RELATED TECHNOLOGIES — cross-link cards into siblings
         ══════════════════════════════════════════════════ */}
      {hasRelatedTechs && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>Related Technologies</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {resolvedTechs.map((rt) => (
              <Link
                key={rt.techSlug}
                href={`/tech/${rt.techSlug}`}
                style={{
                  display: 'block',
                  background: COLOR.cardBg,
                  border: `1px solid ${COLOR.border}`,
                  borderRadius: '8px',
                  padding: '0.9rem 1rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <p style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.01em',
                  color: COLOR.textPrimary,
                }}>
                  {rt.techDisplayName}
                </p>
                {rt.tagline && (
                  <p style={{
                    margin: '0.2rem 0 0',
                    fontSize: '0.82rem',
                    color: COLOR.textSecondary,
                    fontStyle: 'italic',
                  }}>
                    {rt.tagline}
                  </p>
                )}
                <p style={{
                  margin: '0.55rem 0 0',
                  fontSize: '0.88rem',
                  color: COLOR.textPrimary,
                  lineHeight: 1.45,
                }}>
                  {rt.link.relation}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          11. FURTHER READING / LINKS
         ══════════════════════════════════════════════════ */}
      {hasLinks && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>Further Reading</h2>
          <ul style={{ ...proseStyle, paddingLeft: '1.25rem', margin: 0 }}>
            {safeLinks.map((l, i) => (
              <li key={i} style={{ marginBottom: '0.4rem' }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: COLOR.textPrimary, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
