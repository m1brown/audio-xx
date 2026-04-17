import Link from 'next/link';

/**
 * Audio XX — Product detail (placeholder).
 *
 * Reached from a product name on a recommendation card. Real per-product
 * detail view is on the implementation backlog; this placeholder exists so
 * the click affordance is honest and the route resolves.
 *
 * Note: external buy/manufacturer/review links remain inline on the
 * recommendation card; this placeholder is for the deeper Audio-XX-side
 * write-up, not a redirect to the manufacturer.
 */

interface PageProps {
  params: Promise<{ brand: string; name: string }>;
}

function humanize(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export default async function ProductPage({ params }: PageProps) {
  const { brand, name } = await params;
  const brandDisplay = humanize(brand);
  const nameDisplay = humanize(name);

  return (
    <div style={{ maxWidth: 600 }}>
      <p style={{
        fontSize: '0.78rem',
        fontWeight: 500,
        color: '#8C877F',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        margin: '0 0 0.2rem 0',
      }}>
        <Link href={`/brand/${brand}`}>{brandDisplay}</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{nameDisplay}</h1>
      <p className="mb-1" style={{ color: '#5C5852', fontStyle: 'italic' }}>
        Product detail view &mdash; coming soon.
      </p>
      <p className="mb-1">
        This page will hold the full Audio XX write-up for{' '}
        <strong>{brandDisplay} {nameDisplay}</strong>: design choices, sonic
        character, system-fit notes, and the typical trade-offs.
      </p>
      <p className="mb-1">
        <Link href="/">&larr; Back</Link>
      </p>
    </div>
  );
}
