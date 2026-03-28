import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Audio XX',
  description: 'How Audio XX handles your data.',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1>Privacy Policy</h1>

      <p className="mb-1">
        Audio&thinsp;XX is a conversational audio equipment guide. We collect
        only what is needed to provide a useful experience, and nothing more.
      </p>

      <h2>What we collect</h2>
      <p className="mb-1">
        If you create an account, we store your email address, listening
        preferences, and any system or component information you choose to
        enter. This data is used solely to personalise recommendations across
        sessions.
      </p>
      <p className="mb-1">
        Anonymous visitors can use the recommendation engine without providing
        any personal information. No tracking cookies are set for anonymous
        users.
      </p>

      <h2>How we use your data</h2>
      <p className="mb-1">
        Your preferences and system data are used exclusively to generate
        personalised audio recommendations. We do not sell, rent, or share
        your personal information with third parties.
      </p>

      <h2>Affiliate links</h2>
      <p className="mb-1">
        Some product links on this site are affiliate links, including links to
        Amazon.com. When you click an affiliate link and make a purchase, we may
        earn a small commission at no additional cost to you. Affiliate
        relationships do not influence which products are recommended or how
        they are ranked. For more details, see
        our <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>.
      </p>

      <h2>Third-party services</h2>
      <p className="mb-1">
        Audio&thinsp;XX uses the following third-party services:
      </p>
      <ul className="plain mb-1">
        <li>Authentication provider (NextAuth.js) for secure sign-in</li>
        <li>Database hosting for account and preference storage</li>
        <li>Amazon Associates Program for affiliate links</li>
      </ul>

      <h2>Data retention and deletion</h2>
      <p className="mb-1">
        You may delete your account and all associated data at any time by
        contacting us. Upon deletion, all stored preferences, system data, and
        personal information are permanently removed.
      </p>

      <h2>Changes to this policy</h2>
      <p className="mb-1">
        We may update this policy occasionally. Material changes will be noted
        on this page. This policy was last updated on March 26, 2026.
      </p>

      <h2>Contact</h2>
      <p className="mb-1">
        If you have questions about this policy, please reach out via the
        contact information on the site.
      </p>

      <div className="mt-2">
        <Link href="/" className="small muted">Back to home</Link>
      </div>
    </div>
  );
}
