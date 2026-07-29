import Link from 'next/link';

export const metadata = {
  title: 'Publishers & Reviewers',
  description:
    'An invitation to the people who have built the audio knowledge ecosystem to help shape how Audio XX engages with and supports their work.',
};

export default function PublishersReviewers() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1>Publishers &amp; Reviewers</h1>

      <p className="mb-1">
        If you publish thoughtful work about audio — whether in print, on the
        web, YouTube, podcasts, newsletters, or elsewhere — we&rsquo;d love to
        reference your work and help readers discover it.
      </p>

      <p className="mb-1">
        We believe the future of audio should have more original voices, not
        fewer. Audio&thinsp;XX isn&rsquo;t meant to replace thoughtful
        publishing — we hope it encourages readers to discover the people,
        publications, videos, podcasts, and conversations that have shaped this
        hobby for decades.
      </p>

      <p className="mb-1">
        Audio&thinsp;XX is still evolving, and we&rsquo;d genuinely welcome your
        ideas on how we can become a useful participant in the wider audio
        community. This isn&rsquo;t a partnership, a program, or a finished
        policy — it&rsquo;s the start of a conversation.
      </p>

      <h2>As a starting point, we&rsquo;d like to</h2>
      <ul className="plain">
        <li>
          cite and link to original articles, videos, podcasts, interviews, and
          other content where doing so adds value;
        </li>
        <li>
          help readers discover original sources rather than replace them;
        </li>
        <li>
          distinguish clearly between manufacturer information, independent
          publishing, and Audio&thinsp;XX&rsquo;s own analysis.
        </li>
      </ul>

      <h2>Who this is for</h2>
      <p className="mb-1">
        We mean this broadly, for the many kinds of people who do careful,
        original work in this world:
      </p>
      <ul className="plain">
        <li>print and web publications</li>
        <li>independent reviewers</li>
        <li>YouTube creators and podcasters</li>
        <li>newsletter writers and bloggers</li>
        <li>photographers and researchers</li>
        <li>and other thoughtful audio content creators</li>
      </ul>

      <p className="mb-1">
        This is an evolving part of Audio&thinsp;XX, and we&rsquo;d genuinely
        value your ideas, feedback, and suggestions on how we can do this well.
        If you&rsquo;d like to talk — or simply tell us how we could point
        readers toward your work — we&rsquo;d be glad to hear from you at{' '}
        <a href="mailto:hello@audio-xx.com?subject=Publishers%20%26%20Reviewers">
          hello@audio-xx.com
        </a>.
      </p>

      <div className="mt-2">
        <Link href="/about" className="small muted">About Audio XX →</Link>
        {' · '}
        <Link href="/" className="small muted">Back to home</Link>
      </div>
    </div>
  );
}
