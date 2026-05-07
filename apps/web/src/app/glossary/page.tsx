import Link from 'next/link';

import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  slugifyTerm,
  type GlossaryCategory,
  type GlossaryEntry,
} from '@/lib/glossary';

/* ── Styles (mirrors resources/page.tsx) ─────────────── */

const sectionStyle: React.CSSProperties = {
  marginBottom: '2.25rem',
};

const headingStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#2a2a2a',
  marginBottom: '0.65rem',
  letterSpacing: '-0.01em',
  scrollMarginTop: '5rem',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '14.5px',
  lineHeight: 1.72,
  color: '#444',
};

const entryStyle: React.CSSProperties = {
  marginBottom: '1.1rem',
  scrollMarginTop: '5rem',
};

const termStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#2a2a2a',
  fontSize: '15px',
  marginBottom: '2px',
};

const aliasStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: '#888',
  marginLeft: '0.55rem',
  fontWeight: 500,
};

const explanationStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.65,
  color: '#444',
  margin: '0 0 0.25rem 0',
};

const exampleStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.55,
  color: '#666',
  fontStyle: 'italic',
  margin: 0,
};

const tocLinkStyle: React.CSSProperties = {
  color: '#4a7a8a',
  textDecoration: 'none',
  fontWeight: 600,
};

/* ── Helpers ─────────────────────────────────────────── */

function entriesByCategory(category: GlossaryCategory): GlossaryEntry[] {
  return GLOSSARY.filter((entry) => entry.category === category);
}

function GlossaryEntryView({ entry }: { entry: GlossaryEntry }) {
  const slug = slugifyTerm(entry.term);
  return (
    <div id={slug} style={entryStyle}>
      <div>
        <span style={termStyle}>{entry.term}</span>
        {entry.aliases.length > 0 && (
          <span style={aliasStyle}>also: {entry.aliases.join(', ')}</span>
        )}
      </div>
      <p style={explanationStyle}>{entry.explanation}</p>
      {entry.example && <p style={exampleStyle}>{entry.example}</p>}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */

export default function GlossaryPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: '0.35rem' }}>Glossary</h1>
      <p className="muted small" style={{ marginBottom: '1.5rem' }}>
        Short, plain-language explanations of the audio terms used across
        Audio&thinsp;XX. Orientation aids — not encyclopedia entries.
      </p>

      {/* ── In-page navigation ───────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={bodyStyle}>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem 1.25rem',
            }}
          >
            {GLOSSARY_CATEGORIES.map((cat) => (
              <li key={cat.id}>
                <a href={`#${cat.id}`} style={tocLinkStyle}>
                  {cat.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── One section per category ─────────────────── */}
      {GLOSSARY_CATEGORIES.map((cat) => {
        const entries = entriesByCategory(cat.id);
        if (entries.length === 0) return null;
        return (
          <section key={cat.id} style={sectionStyle}>
            <h2 id={cat.id} style={headingStyle}>{cat.label}</h2>
            <div style={bodyStyle}>
              {entries.map((entry) => (
                <GlossaryEntryView key={entry.term} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}

      <hr style={{ margin: '2rem 0 1.25rem' }} />

      <p style={{ fontSize: '13.5px', color: '#888', lineHeight: 1.65 }}>
        These definitions stay deliberately conversational. For deeper
        engineering and listening-tradition references, see the{' '}
        <Link href="/resources" style={tocLinkStyle}>Resources</Link> page.
      </p>

      <div className="mt-2" style={{ marginBottom: '2rem' }}>
        <Link href="/" className="small muted">← Back to home</Link>
      </div>
    </div>
  );
}
