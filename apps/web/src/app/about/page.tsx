import Link from 'next/link';

export default function About() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1>About Audio&thinsp;XX</h1>

      <p className="mb-1">
        Audio&thinsp;XX is an interactive recommendation engine for hi-fi audio.
        You describe what you want from your system — or what isn&rsquo;t
        working — and it recommends gear that fits how you actually listen.
        Not what&rsquo;s popular. Not what&rsquo;s expensive. What works for you.
      </p>

      <p className="mb-1">
        There is no &ldquo;best&rdquo; amplifier, no &ldquo;best&rdquo; DAC, no
        &ldquo;best&rdquo; speaker. There might be a system that&rsquo;s best
        for <em>you</em> — given your taste, the music you love, and the room
        you&rsquo;re in. Audio&thinsp;XX helps you find it.
      </p>

      <p className="mb-1">
        Even the goal of reproducing the &ldquo;original recording&rdquo; is
        more complicated than it sounds — every recording is shaped by the
        microphones, the room, the mixing console, the engineer&rsquo;s
        monitoring speakers, and however many conversions happened along the way.
        There is no single original to be faithful to. Every system is an
        interpretation. Audio&thinsp;XX helps you find yours.
      </p>

      <h2>What you can do here</h2>
      <ul className="plain">
        <li><strong>Get recommendations</strong> — describe your taste, budget, and priorities and get matched gear</li>
        <li><strong>Assess your system</strong> — enter your components and get an honest read on synergy and balance</li>
        <li><strong>Diagnose a problem</strong> — describe what sounds wrong and get likely causes and next steps</li>
        <li><strong>Evaluate a candidate</strong> — considering a specific component? See how it fits your system</li>
        <li><strong>Compare</strong> — weigh two components or systems against your priorities</li>
        <li><strong>Build from scratch</strong> — starting fresh? Get a system designed around how you listen</li>
      </ul>

      <p className="mb-1">
        &ldquo;Do nothing&rdquo; is always a valid recommendation. If your system
        is already well-matched to your taste, Audio&thinsp;XX will tell you so.
      </p>

      <div className="mt-2">
        <Link href="/how-it-works" className="small muted">How it works →</Link>
        {' · '}
        <Link href="/" className="small muted">Back to home</Link>
      </div>
    </div>
  );
}
