import Link from 'next/link';
import {
  findBrandProfileBySlug,
  findProductsByBrandSlug,
} from '@/lib/consultation';
import type { Product } from '@/lib/products/dacs';
import type { AdvisoryOption } from '@/lib/advisory-response';
import AdvisoryProductCards from '@/components/advisory/AdvisoryProductCard';

/**
 * Audio XX — Brand authority page.
 *
 * Full knowledge page for each manufacturer. Sections:
 *   1. Hero — name, tagline, founder/country, optional images
 *   2. Quick identity — Design / Tendency / Trade-off summary card
 *   3. Philosophy — 1–2 paragraphs of design intent
 *   4. Leadership / Origin — founder story and lineage
 *   5. What Reviewers Say — 2–4 attributed quotes
 *   6. Sonic Character — listening tendencies
 *   7. Strengths — bullet list
 *   8. Trade-offs — bullet list
 *   9. Pairing Guidance — prose + bullet list
 *  10. Design Families — sub-cards per product line
 *  11. Links
 *  12. Representative Models — product cards
 *
 * All content sourced verbatim from BrandProfile. No editorial invention.
 * Sections render only when data exists — graceful degradation.
 */

// ── Design tokens ───────────────────────────────────────

const COLOR = {
  textPrimary: '#1F1D1B',
  textSecondary: '#5C5852',
  textMuted: '#8C877F',
  accent: '#B08D57',
  border: '#D8D2C5',
  borderLight: '#E8E3D7',
  cardBg: '#FFFEFA',
} as const;

// Reusable section heading style
const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: COLOR.accent,
  marginBottom: '0.55rem',
  marginTop: 0,
};

const proseStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.96rem',
  lineHeight: 1.75,
  color: COLOR.textSecondary,
};

// ── Adapter: catalog Product → AdvisoryOption ───────────

const CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  dac: 'DAC',
  speaker: 'Speaker',
  amplifier: 'Amplifier',
  integrated: 'Integrated Amplifier',
  turntable: 'Turntable',
  streamer: 'Streamer',
  cartridge: 'Cartridge',
  phono: 'Phono Stage',
  headphone: 'Headphones',
  iem: 'In-Ear Monitor',
  cable: 'Cable',
  other: 'Component',
};

function productToAdvisoryOption(p: Product): AdvisoryOption {
  return {
    name: p.name,
    brand: p.brand,
    price: p.price,
    priceCurrency: p.priceCurrency,
    fitNote: '',
    imageUrl: p.imageUrl,
    productType: CATEGORY_TO_PRODUCT_TYPE[p.category] ?? p.category,
    catalogTopology: p.topology,
    catalogCountry: p.country,
    catalogBrandScale: p.brandScale,
    availability: p.availability,
    typicalMarket: p.typicalMarket,
    usedPriceRange: p.usedPriceRange,
    buyingContext: p.buyingContext,
    manufacturerUrl: p.retailer_links?.[0]?.url,
    links: p.retailer_links?.map((l) => ({ label: l.label, url: l.url })),
    catalogDescription: p.description,
  };
}

function humanizeFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = findBrandProfileBySlug(slug);
  const products = findProductsByBrandSlug(slug);

  const displayName = products[0]?.brand ?? humanizeFromSlug(slug);

  // Metadata line
  const metaParts: string[] = [];
  if (profile?.founder) metaParts.push(profile.founder);
  if (profile?.country) metaParts.push(profile.country);
  if (profile?.brandScale) {
    const scaleLabels: Record<string, string> = {
      boutique: 'Boutique', 'mid-fi': 'Mid-fi', 'hi-fi': 'Hi-fi',
      mainstream: 'Mainstream', specialist: 'Specialist', established: 'Established',
    };
    metaParts.push(scaleLabels[profile.brandScale] ?? profile.brandScale);
  }
  const metaLine = metaParts.join(' \u00b7 ');

  // Feature flags
  const hasIdentity = !!(profile?.designPhilosophy && profile?.sonicTendency && profile?.typicalTradeoff);
  const hasPhilosophy = !!profile?.philosophy;
  const hasPhilosophy2 = !!profile?.philosophyExtended;
  const hasLeadership = !!profile?.leadershipOrigin;
  const hasQuotes = profile?.reviewerQuotes && profile.reviewerQuotes.length > 0;
  const hasTendencies = !!profile?.tendencies;
  const hasStrengths = profile?.strengths && profile.strengths.length > 0;
  const hasTradeoffs = profile?.tradeoffs && profile.tradeoffs.length > 0;
  const hasSystemContext = !!profile?.systemContext;
  const hasPairingNotes = !!profile?.pairingNotes;
  const hasDesignFamilies = profile?.designFamilies && profile.designFamilies.length > 0;
  const hasLinks = profile?.links && profile.links.length > 0;

  // Media
  const mediaImages = profile?.media?.images ?? [];
  const mediaVideos = profile?.media?.videos ?? [];
  const heroImages = mediaImages.slice(0, 2);
  const postPhiloImage = mediaImages[2] ?? null; // 3rd image goes after philosophy
  const hasVideos = mediaVideos.length > 0;

  // Product options
  const options: AdvisoryOption[] = [...products]
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return (a.price ?? 0) - (b.price ?? 0);
    })
    .map(productToAdvisoryOption);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
      {/* ── Back link ── */}
      <p style={{ fontSize: '0.82rem', color: COLOR.textMuted, marginBottom: '1.25rem' }}>
        <Link href="/" style={{ color: COLOR.textMuted }}>&larr; Back</Link>
      </p>

      {/* ══════════════════════════════════════════════════
          1. HERO — brand name, tagline, metadata, images
         ══════════════════════════════════════════════════ */}
      <header style={{ marginBottom: '1.75rem' }}>
        {/* Hero images — media.images first, fallback to representativeImageUrl */}
        {(() => {
          // Prefer curated media images; fall back to legacy fields
          const imgs = heroImages.length > 0
            ? heroImages.map((m) => ({ src: m.url, alt: m.caption ?? displayName, credit: m.credit, sourceUrl: m.sourceUrl }))
            : (() => {
                const src1 = profile?.representativeImageUrl ?? profile?.logoUrl ?? null;
                if (!src1) return [];
                const result: Array<{ src: string; alt: string; credit?: string; sourceUrl?: string }> = [{ src: src1, alt: displayName }];
                if (profile?.secondaryImageUrl) result.push({ src: profile.secondaryImageUrl, alt: `${displayName} — additional` });
                return result;
              })();
          if (imgs.length === 0) return null;
          return (
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}>
              {imgs.map((img, i) => (
                <figure
                  key={i}
                  style={{
                    flex: imgs.length > 1 ? '1 1 50%' : '1 1 100%',
                    margin: 0,
                  }}
                >
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
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                  {img.credit && (
                    <figcaption style={{
                      marginTop: '0.2rem',
                      fontSize: '0.72rem',
                      color: COLOR.textMuted,
                      textAlign: 'right',
                    }}>
                      Image:{' '}
                      {img.sourceUrl ? (
                        <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: COLOR.textMuted, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          {img.credit}
                        </a>
                      ) : img.credit}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          );
        })()}

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
        {profile?.tagline && (
          <p style={{
            margin: '0.35rem 0 0',
            fontSize: '1.05rem',
            color: COLOR.textSecondary,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {profile.tagline}
          </p>
        )}
        {metaLine && (
          <p style={{
            margin: '0.3rem 0 0',
            fontSize: '0.9rem',
            color: COLOR.textMuted,
            letterSpacing: '0.01em',
          }}>
            {metaLine}
          </p>
        )}
      </header>

      {/* ══════════════════════════════════════════════════
          2. QUICK IDENTITY — 3-line summary card
         ══════════════════════════════════════════════════ */}
      {hasIdentity && (
        <section style={{
          marginBottom: '1.75rem',
          padding: '1.1rem 1.3rem',
          background: COLOR.cardBg,
          border: `1px solid ${COLOR.borderLight}`,
          borderLeft: `3px solid ${COLOR.accent}`,
          borderRadius: '4px',
        }}>
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            color: COLOR.textSecondary, fontSize: '0.94rem', lineHeight: 1.7,
          }}>
            <li style={{ marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Design:</span>{' '}
              {profile!.designPhilosophy}
            </li>
            <li style={{ marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Tendency:</span>{' '}
              {profile!.sonicTendency}
            </li>
            <li>
              <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Trade-off:</span>{' '}
              {profile!.typicalTradeoff}
            </li>
          </ul>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          3. PHILOSOPHY — 1–2 paragraphs
         ══════════════════════════════════════════════════ */}
      {hasPhilosophy && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Philosophy</h2>
          <p style={proseStyle}>{profile!.philosophy}</p>
          {hasPhilosophy2 && (
            <p style={{ ...proseStyle, marginTop: '0.65rem' }}>
              {profile!.philosophyExtended}
            </p>
          )}
        </section>
      )}

      {/* ── Post-philosophy image (3rd media image, if any) ── */}
      {postPhiloImage && (
        <figure style={{ margin: '0 0 1.5rem 0' }}>
          <div style={{
            maxHeight: '280px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem 0',
          }}>
            <img
              src={postPhiloImage.url}
              alt={postPhiloImage.caption ?? `${displayName} — detail`}
              loading="lazy"
              style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block' }}
            />
          </div>
          {(postPhiloImage.caption || postPhiloImage.credit) && (
            <figcaption style={{
              marginTop: '0.3rem',
              fontSize: '0.8rem',
              color: COLOR.textMuted,
              textAlign: 'center',
            }}>
              {postPhiloImage.caption && (
                <span style={{ fontStyle: 'italic' }}>{postPhiloImage.caption}</span>
              )}
              {postPhiloImage.credit && (
                <span style={{ display: 'block', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                  Image:{' '}
                  {postPhiloImage.sourceUrl ? (
                    <a href={postPhiloImage.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: COLOR.textMuted, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                      {postPhiloImage.credit}
                    </a>
                  ) : postPhiloImage.credit}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      )}

      {/* ══════════════════════════════════════════════════
          4. LEADERSHIP / ORIGIN
         ══════════════════════════════════════════════════ */}
      {hasLeadership && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Leadership &amp; Origin</h2>
          <p style={proseStyle}>{profile!.leadershipOrigin}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          5. WHAT REVIEWERS SAY — 2–4 attributed quotes
         ══════════════════════════════════════════════════ */}
      {hasQuotes && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>What Reviewers Say</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {profile!.reviewerQuotes!.map((q, i) => (
              <blockquote
                key={i}
                style={{
                  margin: 0,
                  padding: '0.65rem 0.9rem',
                  borderLeft: `3px solid ${COLOR.borderLight}`,
                  background: COLOR.cardBg,
                  borderRadius: '0 4px 4px 0',
                }}
              >
                <p style={{
                  margin: 0,
                  fontSize: '0.94rem',
                  lineHeight: 1.6,
                  color: COLOR.textSecondary,
                  fontStyle: 'italic',
                }}>
                  &ldquo;{q.quote}&rdquo;
                </p>
                <cite style={{
                  display: 'block',
                  marginTop: '0.2rem',
                  fontSize: '0.82rem',
                  color: COLOR.textMuted,
                  fontStyle: 'normal',
                }}>
                  — {q.source}
                </cite>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          6. SONIC CHARACTER
         ══════════════════════════════════════════════════ */}
      {hasTendencies && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Sonic Character</h2>
          <p style={proseStyle}>{profile!.tendencies}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          LISTEN / WATCH — curated video links
         ══════════════════════════════════════════════════ */}
      {hasVideos && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Listen / Watch</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: '0.75rem',
          }}>
            {mediaVideos.map((vid, i) => (
              <a
                key={i}
                href={vid.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  border: `1px solid ${COLOR.borderLight}`,
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: COLOR.cardBg,
                  transition: 'border-color 0.15s',
                }}
              >
                {vid.thumbnailUrl && (
                  <div style={{
                    width: '100%',
                    maxHeight: '160px',
                    overflow: 'hidden',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      loading="lazy"
                      style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}
                <div style={{ padding: '0.55rem 0.75rem' }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: COLOR.textPrimary,
                    lineHeight: 1.35,
                    marginBottom: '0.15rem',
                  }}>
                    {vid.title}
                  </div>
                  <div style={{
                    fontSize: '0.78rem',
                    color: COLOR.accent,
                    fontWeight: 500,
                    marginBottom: vid.summary ? '0.25rem' : 0,
                  }}>
                    {vid.source} &rarr;
                  </div>
                  {vid.summary && (
                    <div style={{
                      fontSize: '0.82rem',
                      color: COLOR.textMuted,
                      lineHeight: 1.45,
                    }}>
                      {vid.summary}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          7 + 8. STRENGTHS & TRADE-OFFS — side by side on desktop
         ══════════════════════════════════════════════════ */}
      {(hasStrengths || hasTradeoffs) && (
        <section style={{
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '1rem',
        }}>
          {hasStrengths && (
            <div>
              <h2 style={sectionHeadingStyle}>Strengths</h2>
              <ul style={{
                margin: 0, paddingLeft: '1.1rem', listStyle: 'disc',
                fontSize: '0.94rem', lineHeight: 1.65, color: COLOR.textSecondary,
              }}>
                {profile!.strengths!.map((s, i) => (
                  <li key={i} style={{ marginBottom: '0.2rem', color: '#5a7050' }}>
                    <span style={{ color: COLOR.textSecondary }}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasTradeoffs && (
            <div>
              <h2 style={sectionHeadingStyle}>Trade-offs</h2>
              <ul style={{
                margin: 0, paddingLeft: '1.1rem', listStyle: 'disc',
                fontSize: '0.94rem', lineHeight: 1.65, color: COLOR.textSecondary,
              }}>
                {profile!.tradeoffs!.map((t, i) => (
                  <li key={i} style={{ marginBottom: '0.2rem', color: '#8a6a50' }}>
                    <span style={{ color: COLOR.textSecondary }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          9. PAIRING GUIDANCE
         ══════════════════════════════════════════════════ */}
      {(hasPairingNotes || hasSystemContext) && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Pairing Guidance</h2>
          {hasSystemContext && <p style={proseStyle}>{profile!.systemContext}</p>}
          {hasPairingNotes && (
            <p style={{ ...proseStyle, marginTop: hasSystemContext ? '0.5rem' : 0 }}>
              {profile!.pairingNotes}
            </p>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          10. DESIGN FAMILIES
         ══════════════════════════════════════════════════ */}
      {hasDesignFamilies && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Design Families</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {profile!.designFamilies!.map((fam) => (
              <div
                key={fam.name}
                style={{
                  padding: '0.75rem 1rem',
                  background: COLOR.cardBg,
                  border: `1px solid ${COLOR.borderLight}`,
                  borderRadius: '4px',
                }}
              >
                <div style={{
                  fontWeight: 600, fontSize: '0.94rem',
                  color: COLOR.textPrimary, marginBottom: '0.25rem',
                }}>
                  {fam.name}
                </div>
                <p style={{ margin: 0, fontSize: '0.91rem', lineHeight: 1.6, color: COLOR.textSecondary }}>
                  {fam.character}
                </p>
                {fam.ampPairing && (
                  <p style={{
                    margin: '0.3rem 0 0', fontSize: '0.88rem', lineHeight: 1.55,
                    color: COLOR.textMuted, fontStyle: 'italic',
                  }}>
                    Pairing: {fam.ampPairing}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          11. LINKS
         ══════════════════════════════════════════════════ */}
      {hasLinks && (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={sectionHeadingStyle}>Links</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
            {profile!.links!.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.9rem', color: COLOR.accent,
                  textDecoration: 'none',
                  borderBottom: `1px solid ${COLOR.borderLight}`,
                  paddingBottom: '1px',
                }}
              >
                {link.label} &rarr;
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          12. REPRESENTATIVE MODELS (was "Catalog")
         ══════════════════════════════════════════════════ */}
      {!profile && products.length > 0 && (
        <p style={{
          marginBottom: '1.5rem', fontSize: '0.92rem',
          color: COLOR.textMuted, fontStyle: 'italic',
        }}>
          No brand profile yet for {displayName}. Showing catalog entries.
        </p>
      )}

      {options.length > 0 ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{
            ...sectionHeadingStyle,
            marginBottom: '1rem',
            color: COLOR.textMuted,
          }}>
            Representative models &mdash; {options.length} {options.length === 1 ? 'product' : 'products'}
          </h2>
          <AdvisoryProductCards options={options} hideMakerInsight />
        </section>
      ) : (
        <div style={{
          fontSize: '0.88rem',
          color: COLOR.textMuted,
          background: COLOR.cardBg,
          border: `1px solid ${COLOR.borderLight}`,
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          lineHeight: 1.6,
        }}>
          <p style={{ margin: 0 }}>
            {displayName} products may appear in advisory recommendations based on your system and preferences.
            Individual product pages are not yet available for this brand.
          </p>
        </div>
      )}
    </div>
  );
}
