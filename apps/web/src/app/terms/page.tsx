import Link from 'next/link';

/*
 * INTERNAL NOTE — not rendered. This is a restrained, product-accurate beta
 * Terms of Service drafted from current functionality only. It is NOT a
 * substitute for legal advice and should receive qualified counsel review
 * before or shortly after launch. Unresolved legal fields (operating legal
 * entity, governing jurisdiction) are intentionally deferred rather than
 * invented — see the "Governing law" and contact sections.
 */

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms for using Audio XX during its public beta.',
};

export default function Terms() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Terms of Service</h1>
      <p className="small muted">Last updated 29 July 2026 · Beta</p>

      <p className="mb-1">
        These terms govern your use of Audio&thinsp;XX. By using the service you
        agree to them. Please read them alongside our{' '}
        <Link href="/privacy">Privacy Policy</Link> and{' '}
        <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>.
      </p>

      <h2>Beta service</h2>
      <p className="mb-1">
        Audio&thinsp;XX is in <strong>public beta</strong>. The product is
        actively evolving — features, content, and behaviour may change,
        pause, or be removed at any time, and the service may occasionally be
        unavailable.
      </p>

      <h2>Assessments are informational</h2>
      <p className="mb-1">
        Audio&thinsp;XX produces assessments, recommendations, comparisons, and
        related analysis for <strong>informational purposes only</strong>. They
        are interpretations, not statements of fact, and are provided
        &ldquo;as is.&rdquo; We make <strong>no guarantee</strong> of accuracy,
        completeness, compatibility, suitability, or any purchasing or listening
        outcome.
      </p>

      <h2>Your decisions</h2>
      <p className="mb-1">
        Buying, configuring, and combining audio equipment is your
        responsibility. Please verify specifications, compatibility, and return
        policies with manufacturers and retailers before making any purchase or
        change to your system. You use Audio&thinsp;XX&rsquo;s output at your own
        discretion and risk.
      </p>

      <h2>Accounts &amp; acceptable use</h2>
      <p className="mb-1">
        Some features may require an account. You are responsible for the
        activity under your account and for keeping your access secure. Please
        don&rsquo;t misuse the service — no attempts to disrupt, overload,
        reverse-engineer, scrape at scale, or access it in violation of law or
        these terms.
      </p>

      <h2>Paid services</h2>
      <p className="mb-1">
        Some functionality may require payment. Where it does, the applicable
        price and billing terms are shown at the point of purchase, and payments
        are handled by our third-party payment processor. Only the terms
        presented to you at purchase apply.
      </p>

      <h2>Intellectual property</h2>
      <p className="mb-1">
        The Audio&thinsp;XX name, site, software, and original analysis are owned
        by Audio&thinsp;XX and its operators. Manufacturer information,
        third-party content, and product imagery remain the property of their
        respective owners. You may read, print, and share your own assessments
        for personal, non-commercial use.
      </p>

      <h2>Third-party links &amp; sources</h2>
      <p className="mb-1">
        Audio&thinsp;XX references and links to manufacturer material and other
        original sources. We don&rsquo;t control that content and aren&rsquo;t
        responsible for it, and a link is not an endorsement. Some links may be
        affiliate links, as described in our{' '}
        <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>.
      </p>

      <h2>Limitation of liability</h2>
      <p className="mb-1">
        To the fullest extent permitted by law, Audio&thinsp;XX and its operators
        are not liable for any indirect, incidental, or consequential damages,
        or for any loss arising from purchasing decisions, system changes, or
        reliance on the service. The service is provided without warranties of
        any kind except those that cannot be excluded by law.
      </p>

      <h2>Termination</h2>
      <p className="mb-1">
        You may stop using Audio&thinsp;XX at any time. We may suspend or end
        access to the service, or to any account, where necessary to protect the
        service or comply with these terms or the law.
      </p>

      <h2>Changes to these terms</h2>
      <p className="mb-1">
        As the beta evolves, we may update these terms. Continued use after an
        update means you accept the revised terms.
      </p>

      <h2>Governing law</h2>
      <p className="mb-1">
        Audio&thinsp;XX is operated during beta while its formal operating entity
        and governing jurisdiction are being finalised; the applicable governing
        law will be stated here once confirmed. Until then, these terms apply to
        the extent permitted by the law that governs your use.
      </p>

      <h2>Contact</h2>
      <p className="mb-1">
        Questions about these terms? Reach us at{' '}
        <a href="mailto:hello@audio-xx.com?subject=Terms%20of%20Service">
          hello@audio-xx.com
        </a>.
      </p>

      <div className="mt-2">
        <Link href="/privacy" className="small muted">Privacy Policy →</Link>
        {' · '}
        <Link href="/about" className="small muted">About →</Link>
        {' · '}
        <Link href="/" className="small muted">Back to home</Link>
      </div>
    </div>
  );
}
