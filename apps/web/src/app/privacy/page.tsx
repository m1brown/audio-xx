import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy',
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
      <p className="mb-1">
        We record a small number of anonymous usage events — for example that an
        assessment was completed, or that a product link was followed — so we can
        tell which parts of Audio&thinsp;XX are useful. These events are written
        to our server logs and are not tied to your name or email address.
      </p>
      <p className="mb-1">
        If you answer one of the short feedback prompts beneath an assessment,
        your answers and any comment you write are recorded together with an
        identifier for the assessment they refer to, so we can tell which piece
        of advice the feedback was about. Feedback is entirely voluntary.
      </p>

      <h2>How we use your data</h2>
      <p className="mb-1">
        Your preferences and system data are used exclusively to generate
        personalised audio recommendations. We do not sell or rent your personal
        information, and we do not pass it to anyone for their own advertising or
        marketing. The service providers listed below handle information only in
        order to run Audio&thinsp;XX.
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
        Audio&thinsp;XX runs on services operated by other companies. These are
        the ones that currently handle information, and what each one receives:
      </p>
      <ul className="plain mb-1">
        <li>
          <strong>Vercel</strong> — hosting. Serves every page and request, and
          stores the server logs, which include the anonymous usage events
          described above and any comment you type into a feedback prompt.
        </li>
        <li>
          <strong>Turso</strong> — database. Stores accounts, saved systems and
          listening preferences.
        </li>
        <li>
          <strong>OpenAI</strong> — language model. When you describe a system or
          ask a question, that text is sent to OpenAI to help generate the
          response you read.
        </li>
        <li>
          <strong>Sentry</strong> — error monitoring. Receives diagnostics when
          something breaks: the error, a stack trace, and the address of the
          page you were on. Request bodies and cookies are removed before a
          report is sent, and your name and email are not included. Note that
          an assessment&rsquo;s web address contains the system description you
          entered, so that text can appear in an error report.
        </li>
        <li>
          <strong>Amazon Associates</strong> — affiliate links. Receives a
          referral tag when you follow a shopping link.
        </li>
      </ul>
      <p className="mb-1">
        Sign-in is handled in Audio&thinsp;XX itself using the NextAuth.js
        library. It is not a separate company and your credentials are not sent
        to a third party for authentication.
      </p>
      <p className="mb-1">
        An email service (Resend) is integrated but is not currently in use:
        password-reset email is switched off, and no other feature sends mail.
        If that changes, this page will be updated first.
      </p>

      <h2>Data retention and deletion</h2>
      <p className="mb-1">
        You may delete your account and all associated data at any time by
        contacting us. Your account, saved systems, assessments and stored
        preferences are permanently removed. Server logs and error reports are
        held separately by the services above and expire on their own schedule
        rather than being deleted on request.
      </p>

      <h2>Changes to this policy</h2>
      <p className="mb-1">
        We may update this policy occasionally. Material changes will be noted
        on this page. This policy was last updated on August 7, 2026.
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
