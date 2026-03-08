import Link from 'next/link';

export default function About() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1>How this works</h1>

      <p className="mb-1">
        You describe what you hear. The system maps your words to listening traits,
        matches them against deterministic rules, and returns 1–2 suggestions with
        trade-offs, risks, and a reversible next step.
      </p>

      <p className="mb-1">
        No ML, no hidden rankings, no shopping engine. Every output shows which rules
        fired and why. "No purchase recommended" is a first-class outcome.
      </p>

      <h2>Modes</h2>
      <ul className="plain">
        <li><strong>Evaluate</strong> — describe what you're hearing, get trait-based feedback</li>
        <li><strong>Diagnose</strong> — describe symptoms, get likely causes and next steps</li>
        <li><strong>Candidate</strong> — evaluate a specific component against your system</li>
        <li><strong>Compare</strong> — compare two saved systems, see trait deltas</li>
        <li><strong>Check-in</strong> — confirm your system is performing well</li>
        <li><strong>Build</strong> — start or extend a system</li>
      </ul>

      <div className="mt-2">
        <Link href="/" className="small muted">Back</Link>
      </div>
    </div>
  );
}
