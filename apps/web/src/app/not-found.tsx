import Link from 'next/link';

/**
 * 404 (MVP M5) — an Audio XX page, not a server error. Clear language,
 * a way back to building, no technical jargon.
 */
export default function NotFound() {
  return (
    <main style={{ maxWidth: '30rem', margin: '0 auto', padding: '6rem 1.25rem 8rem', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--face-grotesque)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#6B6862',
          marginBottom: '1.2rem',
        }}
      >
        Audio XX
      </div>
      <h1
        style={{
          fontFamily: 'var(--face-display, var(--face-text))',
          fontSize: '2.2rem',
          lineHeight: 1.15,
          color: '#1B1A18',
          margin: '0 0 1rem',
        }}
      >
        This page isn&rsquo;t in the collection.
      </h1>
      <p style={{ fontFamily: 'var(--face-text)', fontSize: '1.02rem', lineHeight: 1.6, color: '#6B6862', margin: '0 0 2.2rem' }}>
        The address may have been mistyped, or the page may have moved.
        Your systems and assessments are unaffected.
      </p>
      <div style={{ display: 'flex', gap: '1.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--face-grotesque)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#FCF8EE',
            background: '#1B1A18',
            border: '1px solid #1B1A18',
            padding: '0.7rem 1.4rem',
            textDecoration: 'none',
          }}
        >
          Build a system
        </Link>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--face-grotesque)',
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#6B6862',
            borderBottom: '1px solid rgba(27, 26, 24, 0.14)',
            paddingBottom: '2px',
            textDecoration: 'none',
            alignSelf: 'center',
          }}
        >
          Home
        </Link>
      </div>
    </main>
  );
}
