import Link from 'next/link';

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

const bodyStyle: React.CSSProperties = {
  fontSize: '14.5px',
  lineHeight: 1.72,
  color: '#444',
};

const resourceStyle: React.CSSProperties = {
  marginBottom: '0.85rem',
};

const resourceNameStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#444',
};

const resourceLinkStyle: React.CSSProperties = {
  color: '#4a7a8a',
  textDecoration: 'none',
  fontWeight: 600,
};

const resourceDescStyle: React.CSSProperties = {
  fontSize: '13.5px',
  lineHeight: 1.6,
  color: '#666',
  marginTop: '2px',
};

/* ── Helpers ──────────────────────────────────────────── */

function Resource({ name, url, children }: { name: string; url?: string; children: React.ReactNode }) {
  return (
    <div style={resourceStyle}>
      <div>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" style={resourceLinkStyle}>
            {name} ↗
          </a>
        ) : (
          <span style={resourceNameStyle}>{name}</span>
        )}
      </div>
      <div style={resourceDescStyle}>{children}</div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function Resources() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: '0.35rem' }}>Resources</h1>
      <p className="muted small" style={{ marginBottom: '2rem' }}>
        The science, engineering, and listening traditions behind Audio&thinsp;XX.
      </p>

      {/* ── 1. Introduction ─────────────────────────────── */}
      <section style={sectionStyle}>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Audio&thinsp;XX draws on a wide range of audio knowledge — scientific
            research, engineering principles, measurement analysis, and decades of
            careful listening-based system evaluation.
          </p>
          <p>
            Different perspectives exist within audio, and they do not always
            agree. Audio&thinsp;XX aims to synthesize these perspectives into a
            practical advisory framework rather than adopt any single school of
            thought.
          </p>
        </div>
      </section>

      {/* ── 2. Sound and Perception ─────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Understanding Sound and Perception</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            How we perceive sound is not a simple function of what a microphone
            measures. Human hearing is shaped by psychoacoustic mechanisms —
            the ways our brains process, prioritize, and interpret audio signals.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Several areas of perception are particularly relevant to how audio
            systems sound: tonal balance, which describes where energy
            concentrates across the frequency range. Transient behavior — how
            quickly and cleanly a system starts and stops notes. Dynamics, meaning
            the contrast between quiet and loud passages and the sense of
            liveliness in music. And spatial perception — how the brain constructs
            a sense of width, depth, and instrument placement from two speakers.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Auditory masking also plays an important role. Louder sounds can
            obscure quieter ones, and the brain selectively attends to certain
            frequencies and timing cues. These mechanisms help explain why two
            systems with similar measurements can sound quite different.
          </p>

          <Resource name="Floyd Toole" url="https://www.routledge.com/Sound-Reproduction-The-Acoustics-and-Psychoacoustics-of-Loudspeakers-and-Rooms/Toole/p/book/9781138921368">
            Foundational research on loudspeaker performance, room acoustics, and
            the relationship between measurements and perceived sound quality.
          </Resource>
          <Resource name="Sean Olive" url="https://seanolive.blogspot.com/">
            Research into listener preferences, headphone target curves, and
            trained listening methodology. His work has helped establish
            measurable correlates of perceived audio quality.
          </Resource>
        </div>
      </section>

      {/* ── 3. Engineering and Electronics ──────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Audio Engineering and Electronics</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            The engineering behind audio equipment shapes what listeners
            ultimately hear. Different design approaches make different
            trade-offs, and understanding those trade-offs helps explain why
            equipment with similar specifications can sound and feel different
            in practice.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Amplifier topology — whether single-ended triode, push-pull, or
            solid-state class A, AB, or D — determines how power is delivered
            and how distortion behaves under load. DAC architecture matters
            too: delta-sigma designs prioritize measured precision, R2R ladder
            DACs often emphasize tonal density and flow, and FPGA-based designs
            allow custom digital filtering strategies. Speaker design involves
            its own set of trade-offs between efficiency, bandwidth, cabinet
            behavior, and crossover complexity.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Distortion and noise are relevant, but their audibility depends
            heavily on type and context. Low-order harmonic distortion may be
            inaudible or even pleasant at low levels, while higher-order
            products and intermodulation distortion tend to cause fatigue.
          </p>

          <Resource name="Audio Engineering Society (AES)" url="https://www.aes.org/">
            The professional body for audio engineering. Publishes peer-reviewed
            research on acoustics, electronics, signal processing, and
            psychoacoustics.
          </Resource>
        </div>
      </section>

      {/* ── 4. Measurement and Objective Analysis ──────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Measurement and Objective Analysis</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Measurements provide important technical insight into audio
            equipment. Frequency response, distortion profiles, noise floors,
            and impedance behavior all reveal real characteristics of a
            component's performance.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            At the same time, measurements and listening evaluate different
            things. A frequency response graph describes amplitude across
            frequency. It does not describe how a system renders timing,
            texture, or spatial depth — qualities that listeners respond to
            strongly but that require different analytical frameworks to assess.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Both perspectives are valuable. Neither is complete alone.
            Audio&thinsp;XX treats measurements as one input among several,
            not as the sole arbiter of quality.
          </p>

          <Resource name="Audio Science Review (ASR)" url="https://www.audiosciencereview.com/">
            Community-driven measurement and analysis of audio equipment.
            A useful resource for objective performance data and technical
            discussion.
          </Resource>
        </div>
      </section>

      {/* ── 5. Listening-Based Evaluation ──────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Listening-Based Evaluation</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Much of what the audio field knows about how equipment performs in
            practice has developed through careful, sustained listening over
            decades. This is not casual opinion — it is a structured tradition
            with its own methodology and shared descriptive language.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Experienced listeners typically evaluate complete systems rather
            than isolated components. They focus on long-term listening rather
            than quick A/B comparisons. They pay attention to tonal character,
            dynamic behavior, spatial presentation, and how a system sustains
            engagement over hours rather than minutes.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            This listening tradition plays a central role in how real-world
            audio systems are understood, built, and refined. Audio&thinsp;XX
            draws heavily from it.
          </p>

          <Resource name="6moons" url="https://www.6moons.com/">
            Extremely thorough and detailed reviews, fast gear, high-resolution
            digital audio. Introduced me to Job Integrated, Crayon CIA, WLM Diva,
            and more. Emphasizes system synergy, tonal character, and long-term
            listening impressions. Known for covering lesser-known manufacturers
            and design philosophies.
          </Resource>
          <Resource name="The Absolute Sound" url="https://www.theabsolutesound.com/">
            Focuses on musical realism and high-end system building. Emphasizes
            the relationship between equipment and the experience of live music.
          </Resource>
          <Resource name="Darko.Audio" url="https://darko.audio/">
            Bridges traditional listening evaluation with modern digital
            systems, streaming, and desktop audio.
          </Resource>
          <Resource name="Twittering Machines" url="https://twitteringmachines.com/">
            Thoughtful, literate reviews with an emphasis on musical engagement
            and how equipment serves the listening experience.
          </Resource>
          <Resource name="Mono and Stereo" url="https://www.monoandstereo.com/">
            Covers high-end and ultra-high-end audio with detailed photography
            and system context. Strong coverage of European and boutique manufacturers.
          </Resource>
        </div>
      </section>

      {/* ── 6. Learning to Listen ──────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Learning to Listen</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.65rem' }}>
            Developing your ear is not about memorizing technical terms. It is
            about building familiarity with how music sounds through your system
            and noticing what changes when something in the chain changes.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            A few practices help. Use recordings you know well — music you have
            heard hundreds of times, where you know what to expect. Acoustic
            instruments and voice are particularly revealing because most people
            have a strong internal reference for how they sound in real life.
          </p>
          <p style={{ marginBottom: '0.65rem' }}>
            Pay attention to decay — how notes fade into silence. Listen for the
            sense of space around instruments. Notice whether dynamics feel alive
            or compressed. These qualities often separate systems more clearly
            than tonal balance alone.
          </p>
          <p>
            Trust long-term impressions over quick judgments. The system you want
            to listen to for hours is more important than the one that impresses
            in the first thirty seconds.
          </p>
        </div>
      </section>

      {/* ── 7. Educational YouTube Channels ────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Educational YouTube Channels</h2>
        <div style={bodyStyle}>
          <p style={{ marginBottom: '0.85rem' }}>
            A small set of channels that explain audio concepts clearly, with a
            focus on teaching rather than hype.
          </p>

          <Resource name="Steve Guttenberg — Audiophiliac" url="https://www.youtube.com/@Audiophiliac">
            Decades of experience as an audio journalist. Calm, practical
            perspectives on equipment and listening.
          </Resource>
          <Resource name="A British Audiophile" url="https://www.youtube.com/@ABritishAudiophile">
            Thoughtful system-level thinking with an emphasis on synergy,
            room interaction, and realistic expectations.
          </Resource>
          <Resource name="Darko.Audio" url="https://www.youtube.com/@DarkoAudio">
            Well-produced explorations of both analog and digital audio,
            with clear explanations of how and why equipment choices matter.
          </Resource>
        </div>
      </section>

      <hr style={{ margin: '2rem 0 1.25rem' }} />

      <p style={{ fontSize: '13.5px', color: '#888', lineHeight: 1.65 }}>
        Audio&thinsp;XX does not endorse any single source or methodology.
        The resources above represent different perspectives within a complex
        field. Understanding multiple viewpoints helps listeners make more
        informed and confident decisions.
      </p>

      <div className="mt-2" style={{ marginBottom: '2rem' }}>
        <Link href="/" className="small muted">← Back to home</Link>
      </div>
    </div>
  );
}
