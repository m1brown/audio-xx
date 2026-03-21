import Link from 'next/link';

/* ── Inline SVG diagrams ─────────────────────────────── */

function AxesDiagram() {
  const axes = [
    { label: 'Warm', opposite: 'Bright', color: '#b58a4c' },
    { label: 'Smooth', opposite: 'Detailed', color: '#7a9a6a' },
    { label: 'Elastic', opposite: 'Controlled', color: '#6a7fa8' },
    { label: 'Airy', opposite: 'Closed', color: '#9a6a8a' },
  ];
  const w = 340;
  const rowH = 36;
  const pad = 12;
  const h = axes.length * rowH + pad * 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Four sonic axes">
      {axes.map((a, i) => {
        const y = pad + i * rowH + rowH / 2;
        const barX = 80;
        const barW = 180;
        return (
          <g key={a.label}>
            <text x={barX - 8} y={y + 4} textAnchor="end" fontSize="12" fontWeight="500" fill="#555">
              {a.label}
            </text>
            <line x1={barX} y1={y} x2={barX + barW} y2={y} stroke="#e0ddd6" strokeWidth="2" />
            <circle cx={barX} cy={y} r="4" fill={a.color} />
            <circle cx={barX + barW} cy={y} r="4" fill={a.color} />
            <text x={barX + barW + 8} y={y + 4} textAnchor="start" fontSize="12" fontWeight="500" fill="#555">
              {a.opposite}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ProcessDiagram() {
  const steps = [
    { num: '1', label: 'Listener\npreferences' },
    { num: '2', label: 'System\nassessment' },
    { num: '3', label: 'Alignment\nanalysis' },
    { num: '4', label: 'Directional\nguidance' },
  ];
  const boxW = 110;
  const boxH = 56;
  const gap = 24;
  const w = steps.length * boxW + (steps.length - 1) * gap + 40;
  const h = boxH + 40;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Advisory process steps">
      {steps.map((s, i) => {
        const x = 20 + i * (boxW + gap);
        const y = 12;
        const lines = s.label.split('\n');
        return (
          <g key={s.num}>
            <rect
              x={x} y={y} width={boxW} height={boxH} rx="8"
              fill="#faf9f7" stroke="#ddd9d0" strokeWidth="1.2"
            />
            <text x={x + 14} y={y + 20} fontSize="16" fontWeight="700" fill="#a89870">
              {s.num}
            </text>
            {lines.map((line, li) => (
              <text
                key={li}
                x={x + boxW / 2 + 6}
                y={y + 22 + li * 15}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="#555"
              >
                {line}
              </text>
            ))}
            {i < steps.length - 1 && (
              <line
                x1={x + boxW + 4} y1={y + boxH / 2}
                x2={x + boxW + gap - 4} y2={y + boxH / 2}
                stroke="#ccc7ba" strokeWidth="1.5"
                markerEnd="url(#arrow)"
              />
            )}
          </g>
        );
      })}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ccc7ba" />
        </marker>
      </defs>
    </svg>
  );
}

/* ── Styles ───────────────────────────────────────────── */

const sectionStyle: React.CSSProperties = {
  marginBottom: '2.25rem',
};

const headingStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#2a2a2a',
  marginBottom: '0.65rem',
  letterSpacing: '-0.01em',
};

const subheadStyle: React.CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 600,
  color: '#555',
  marginBottom: '0.4rem',
  marginTop: '1rem',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '14.5px',
  lineHeight: 1.72,
  color: '#444',
};

const diagramWrapStyle: React.CSSProperties = {
  margin: '1.25rem 0',
  overflowX: 'auto',
};

const axisPairStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.6rem 1.5rem',
  marginTop: '0.75rem',
  marginBottom: '0.5rem',
};

const axisPairItemStyle: React.CSSProperties = {
  fontSize: '13.5px',
  lineHeight: 1.6,
  color: '#555',
};

const axisPairLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#444',
};

/* ── Page ─────────────────────────────────────────────── */

export default function HowItWorks() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: '0.35rem' }}>How It Works</h1>
      <p className="muted small" style={{ marginBottom: '2rem' }}>
        Audio&thinsp;XX Methodology
      </p>

      {/* ── 1. The Problem ──────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>The Problem Audio&thinsp;XX Solves</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Building a satisfying audio system is harder than it should be.
            Most listeners cannot audition equipment before purchasing. Reviews are
            subjective and often contradictory. And the question that matters most —
            how will this component behave <em>inside my system</em>, given what
            <em> I</em> value? — is rarely addressed.
          </p>
          <p>
            System synergy and listener preference matter more than the quality of
            any single component. Yet most buying decisions focus on components in
            isolation. Audio&thinsp;XX exists to close that gap.
          </p>
        </div>
      </section>

      {/* ── 2. No Best, Only Aligned ─────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>There Is No &ldquo;Best&rdquo;</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            There is no best amplifier, no best DAC, no best speaker. There might be
            a system that&rsquo;s best <em>for you</em> — given your taste, your
            music, your room, and the trade-offs you&rsquo;re willing to make. But
            that&rsquo;s a personal alignment question, not a universal ranking.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Even the idea of &ldquo;getting as close to the original recording as
            possible&rdquo; is more complicated than it sounds. Recordings are shaped
            by the microphones used, the room they were captured in, the mixing
            console, the monitoring speakers the engineer was listening through, and
            however many analog-to-digital and digital-to-analog conversions happened
            along the way. There is no single &ldquo;original&rdquo; to faithfully
            reproduce — only a chain of creative and technical decisions that
            produced the file or disc you&rsquo;re playing back.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            This is not a flaw in audio. It&rsquo;s the nature of it. Every system
            is an interpretation. Some prioritize accuracy, some prioritize musicality,
            some prioritize raw emotional impact. None of these is more correct than
            the others.
          </p>
          <p>
            Audio&thinsp;XX doesn&rsquo;t pretend to know what sounds best. It helps
            you understand what you respond to, and matches that to equipment that
            supports it. The goal is a system that keeps you listening — not one that
            wins a spec sheet competition.
          </p>
        </div>
      </section>

      {/* ── 3. Two Models, One Bridge ──────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>The Core Idea</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Audio&thinsp;XX uses two separate models: one to describe what you
            value as a listener, and another to describe what equipment sounds
            like.
          </p>
          <p>
            When you ask for a recommendation, the advisory engine bridges the
            two — it evaluates how a component or system change would move your
            setup relative to what you actually care about. That bridge is what
            makes the guidance personal rather than generic.
          </p>
        </div>
      </section>

      {/* ── 3. Listener Profile ─────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Listener Profile</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Before recommending anything, Audio&thinsp;XX builds a picture of what
            you value as a listener. Your taste profile is mapped across seven
            dimensions:
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem 1.5rem', margin: '0.75rem 0',
          }}>
            {[
              { trait: 'Flow', desc: 'Ease, continuity, and musical phrasing' },
              { trait: 'Clarity', desc: 'Detail, separation, and resolution' },
              { trait: 'Rhythm', desc: 'Pace, drive, and rhythmic energy' },
              { trait: 'Tonal Density', desc: 'Body, weight, and harmonic richness' },
              { trait: 'Spatial Depth', desc: 'Soundstage, air, and imaging depth' },
              { trait: 'Dynamics', desc: 'Punch, contrast, and dynamic life' },
              { trait: 'Warmth', desc: 'Lower-midrange color and tonal warmth' },
            ].map((t) => (
              <div key={t.trait} style={axisPairItemStyle}>
                <span style={axisPairLabelStyle}>{t.trait}</span><br />
                {t.desc}
              </div>
            ))}
          </div>

          <p style={{ marginBottom: '0.65rem' }}>
            These are not questions you need to answer upfront. You describe what
            you like in plain language — "I want something musical and relaxed" or
            "I listen mostly to jazz and want to hear the room" — and
            Audio&thinsp;XX maps your words to these traits. The profile evolves
            as your preferences become clearer through conversation.
          </p>
          <p>
            The radar chart you see in the app visualizes this profile. It shows
            where your priorities concentrate, not how "good" your taste is.
            Every shape is valid.
          </p>
        </div>
      </section>

      {/* ── 4. System Character ─────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>System Character</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Equipment is described using a different model — four sonic axes that
            capture how a component or system sounds:
          </p>

          <div style={diagramWrapStyle}>
            <AxesDiagram />
          </div>

          <div style={axisPairStyle}>
            <div style={axisPairItemStyle}>
              <span style={axisPairLabelStyle}>Warm ↔ Bright</span><br />
              Tonal balance — where energy concentrates across the frequency range.
            </div>
            <div style={axisPairItemStyle}>
              <span style={axisPairLabelStyle}>Smooth ↔ Detailed</span><br />
              Texture — how much fine information is presented versus blended.
            </div>
            <div style={axisPairItemStyle}>
              <span style={axisPairLabelStyle}>Elastic ↔ Controlled</span><br />
              Timing — how freely or precisely the system renders rhythm.
            </div>
            <div style={axisPairItemStyle}>
              <span style={axisPairLabelStyle}>Airy ↔ Closed</span><br />
              Spatial character — open, breathing presentation versus dense, focused imaging.
            </div>
          </div>

          <p style={{ marginBottom: '0.65rem' }}>
            These axes are not scores. They describe tendencies — where a component
            sits on a continuum. Neither end is inherently better.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Each product also carries detailed tendency notes across five
            domains — tonality, timing, spatial, dynamics, and texture — curated
            from professional reviews and listening reports. These provide the
            nuance that the four axes frame.
          </p>
          <p>
            Crucially, components are not evaluated in isolation. A warm amplifier
            paired with bright speakers produces a different result than either
            component alone. Audio&thinsp;XX models the interaction between
            components to assess how a system behaves as a whole.
          </p>
        </div>
      </section>

      {/* ── 5. Advisory Process ─────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Advisory Process</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.75rem' }}>
            When you ask Audio&thinsp;XX for guidance, the process follows four
            stages:
          </p>
        </div>

        <div style={diagramWrapStyle}>
          <ProcessDiagram />
        </div>

        <div style={bodyStyle}>
          <div style={subheadStyle}>1. Understand listener preferences</div>
          <p style={{ marginBottom: '0.5rem' }}>
            Your listening goals and taste profile form the reference point for
            every recommendation. If these are unclear, Audio&thinsp;XX asks
            clarifying questions before proceeding.
          </p>

          <div style={subheadStyle}>2. Assess the current system</div>
          <p style={{ marginBottom: '0.5rem' }}>
            If you have existing equipment, the system is evaluated as an
            integrated whole — how its components interact and where the combined
            sonic character sits.
          </p>

          <div style={subheadStyle}>3. Identify alignment or mismatch</div>
          <p style={{ marginBottom: '0.5rem' }}>
            The system's character is compared to your preferences. Where they
            align, the system is working for you. Where they diverge, there may
            be an opportunity — or there may not. Sometimes the divergence is
            intentional or desirable.
          </p>

          <div style={subheadStyle}>4. Offer directional guidance</div>
          <p>
            Audio&thinsp;XX suggests components or changes that move the system
            toward your goals, always with trade-offs clearly stated. "Do nothing"
            is always a valid outcome. Restraint is treated as an intelligent
            decision, not a missed opportunity.
          </p>
        </div>
      </section>

      {/* ── 6. Why Systems Matter ───────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Why Systems Matter</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Most audio advice evaluates components in isolation — is this amplifier
            good? Is that DAC worth the price? These are incomplete questions.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Components interact. A technically excellent amplifier may not be the
            right amplifier for your speakers, your room, or your priorities.
            System balance matters more than individual gear quality. An upgrade
            that moves the system away from your preferences is not an upgrade at
            all.
          </p>
          <p>
            Audio&thinsp;XX evaluates whether a change moves the whole system in a
            direction you actually want. That is a fundamentally different question
            from whether a component is objectively good.
          </p>
        </div>
      </section>

      {/* ── 7. Visual Tools ─────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Visual Tools</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Audio&thinsp;XX uses radar charts in two contexts. Your taste profile
            is shown as a seven-dimension chart reflecting your listening
            priorities. During system assessments, a separate chart visualizes
            the sonic character of your equipment along its own dimensions.
          </p>
          <p>
            Both charts are designed to support understanding, not to act as
            precise measurements. They are orientation tools, not verdicts.
          </p>
        </div>
      </section>

      {/* ── 8. What Uses AI and What Doesn't ──────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>What Uses AI and What Doesn&rsquo;t</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.85rem' }}>
            Audio&thinsp;XX is not a wrapper around a language model. Most of
            the system is deterministic — built from curated data and structured
            rules. AI plays a supporting role in specific, bounded areas.
          </p>

          <div style={subheadStyle}>Built without AI</div>
          <p style={{ marginBottom: '0.65rem' }}>
            The product catalog, including every sonic tendency, interaction note,
            and trade-off description, is researched and curated by hand from
            professional reviews, listening reports, and established community
            knowledge. Nothing is scraped or summarized in real time.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            The matching engine — how your preferences map to products, how
            system interaction is modeled, how alignment and mismatch are
            identified — is entirely rule-based. The intake questions, the
            scoring logic, the system-level chain analysis, the radar charts,
            and the editorial verdicts all run deterministically. Given the same
            input, they produce the same output every time.
          </p>

          <div style={subheadStyle}>Where AI assists</div>
          <p style={{ marginBottom: '0.65rem' }}>
            AI is used in three specific areas. First, interpreting natural
            language: when you describe what you want in your own words — "something
            musical and easy to listen to" — AI helps translate that into the
            structured trait signals the engine works with.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Second, the conversational prose layer. After the deterministic engine
            produces its analysis, AI helps present the findings in a natural,
            readable tone rather than raw structured output.
          </p>
          <p>
            Third, when you ask about a product not yet in the catalog, AI can
            draw on its general knowledge to provide a provisional assessment.
            These cases are identified as provisional — they carry less certainty
            than curated catalog entries.
          </p>
        </div>
      </section>

      <div className="mt-2" style={{ marginBottom: '2rem' }}>
        <Link href="/" className="small muted">← Back to home</Link>
      </div>
    </div>
  );
}
