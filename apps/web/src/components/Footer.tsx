import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid #eae8e4',
        padding: '1.25rem 1.5rem',
        marginTop: '3rem',
        background: '#fafaf8',
      }}
    >
      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
          fontSize: '12.5px',
          color: '#999',
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              href="/privacy"
              style={{ color: '#888', fontSize: '12.5px' }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/affiliate-disclosure"
              style={{ color: '#888', fontSize: '12.5px' }}
            >
              Affiliate Disclosure
            </Link>
            <Link
              href="/about"
              style={{ color: '#888', fontSize: '12.5px' }}
            >
              About
            </Link>
          </div>
        </div>

        <p style={{ margin: 0, color: '#aaa' }}>
          Audio&thinsp;XX may earn commissions from qualifying purchases as an
          Amazon Associate. This does not affect our recommendations.
        </p>
      </div>
    </footer>
  );
}
