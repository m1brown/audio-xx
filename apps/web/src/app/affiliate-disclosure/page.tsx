import Link from 'next/link';

export const metadata = {
  title: 'Affiliate Disclosure — Audio XX',
  description: 'How Audio XX uses affiliate links.',
};

export default function AffiliateDisclosurePage() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1>Affiliate Disclosure</h1>

      <p className="mb-1">
        Audio&thinsp;XX may earn commissions from qualifying purchases as an
        Amazon Associate. This does not affect our recommendations.
      </p>

      <h2>How it works</h2>
      <p className="mb-1">
        Some product links on Audio&thinsp;XX direct you to Amazon.com. If you
        click one of these links and make a purchase, we may earn a small
        commission at no additional cost to you.
      </p>

      <h2>Independence</h2>
      <p className="mb-1">
        Affiliate relationships do not influence which products are recommended
        or how they are presented. Recommendations are based on your
        preferences, listening priorities, and system context — never on
        commission potential. Products from brands not available on Amazon are
        recommended just as readily. Amazon links are provided as a convenience
        alongside manufacturer and dealer links.
      </p>

      <h2>Why we use affiliate links</h2>
      <p className="mb-1">
        Affiliate revenue helps support the development of Audio&thinsp;XX and
        keeps the site accessible without charging users.
      </p>

      <h2>Other relationships</h2>
      <p className="mb-1">
        Amazon Associates is currently the only affiliate program
        Audio&thinsp;XX participates in. This page will be updated if that
        changes.
      </p>

      <div className="mt-2">
        <Link href="/privacy" className="small muted">Privacy Policy</Link>
        {' · '}
        <Link href="/" className="small muted">Back to home</Link>
      </div>
    </div>
  );
}
