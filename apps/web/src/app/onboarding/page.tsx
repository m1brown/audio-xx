'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/* ── Types ────────────────────────────────────────────── */

type Intent = 'understand' | 'improve' | 'choose' | 'explore';
type Experience = 'beginner' | 'intermediate' | 'experienced';
type ListeningStyle = 'focused' | 'background' | 'both';
type RoomSize = 'nearfield' | 'small' | 'medium' | 'large';
type Volume = 'low' | 'moderate' | 'loud';

interface SonicPref {
  key: string;
  label: string;
  desc: string;
  /** Maps to the 4 system axes used in evaluation. */
  axisMapping: Record<string, number>;
}

interface SystemInput {
  speakers: string;
  amplifier: string;
  dac: string;
  source: string;
}

interface OnboardingData {
  intent: Intent | null;
  experience: Experience | null;
  sonicPrefs: string[];        // max 2 keys from SONIC_OPTIONS
  musicGenres: string[];
  listeningStyle: ListeningStyle | null;
  roomSize: RoomSize | null;
  volume: Volume | null;
  hasSystem: boolean | null;
  system: SystemInput;
}

/* ── Constants ────────────────────────────────────────── */

const TOTAL_STEPS = 7;

const INTENT_OPTIONS: { value: Intent; label: string; desc: string }[] = [
  { value: 'understand', label: 'Understand my current system', desc: 'Learn what your system does well and where it could improve.' },
  { value: 'improve', label: 'Improve my system', desc: 'Find the next meaningful upgrade.' },
  { value: 'choose', label: 'Choose new equipment', desc: 'Build a system or pick components from scratch.' },
  { value: 'explore', label: 'Just exploring', desc: 'Learn about audio and discover what matters to you.' },
];

const EXPERIENCE_OPTIONS: { value: Experience; label: string; desc: string }[] = [
  { value: 'beginner', label: 'New to hi-fi', desc: 'Just getting started or haven\'t explored much yet.' },
  { value: 'intermediate', label: 'Some experience', desc: 'You\'ve owned a few systems and know what you like.' },
  { value: 'experienced', label: 'Experienced listener', desc: 'You\'ve been at this a while and have strong preferences.' },
];

const SONIC_OPTIONS: SonicPref[] = [
  {
    key: 'warm_smooth',
    label: 'Warm and smooth',
    desc: 'Rich tonal weight, relaxed presentation, easy to listen to for hours.',
    axisMapping: { warm_bright: -1.5, smooth_detailed: -1, elastic_controlled: -0.5, airy_closed: 0 },
  },
  {
    key: 'clear_detailed',
    label: 'Clear and detailed',
    desc: 'Resolution, separation, and transparency. You want to hear everything.',
    axisMapping: { warm_bright: 0.5, smooth_detailed: 1.5, elastic_controlled: 0.5, airy_closed: 0.5 },
  },
  {
    key: 'dynamic_energetic',
    label: 'Dynamic and energetic',
    desc: 'Punch, rhythmic drive, and a sense of aliveness in the music.',
    axisMapping: { warm_bright: 0, smooth_detailed: 0.5, elastic_controlled: 1.5, airy_closed: 0 },
  },
  {
    key: 'open_spacious',
    label: 'Open and spacious',
    desc: 'Wide soundstage, air between instruments, a sense of being in the room.',
    axisMapping: { warm_bright: -0.5, smooth_detailed: 0, elastic_controlled: -0.5, airy_closed: -1.5 },
  },
];

const GENRE_OPTIONS = [
  { value: 'acoustic', label: 'Acoustic' },
  { value: 'classical', label: 'Classical' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'rock', label: 'Rock' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'vocal', label: 'Vocal / Singer-songwriter' },
  { value: 'mixed', label: 'Mixed / Everything' },
];

const STYLE_OPTIONS: { value: ListeningStyle; label: string }[] = [
  { value: 'focused', label: 'Focused listening' },
  { value: 'background', label: 'Background listening' },
  { value: 'both', label: 'Both' },
];

const ROOM_OPTIONS: { value: RoomSize; label: string }[] = [
  { value: 'nearfield', label: 'Nearfield / Desktop' },
  { value: 'small', label: 'Small room' },
  { value: 'medium', label: 'Medium room' },
  { value: 'large', label: 'Large room' },
];

const VOLUME_OPTIONS: { value: Volume; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'loud', label: 'Loud' },
];

/* ── Styles ───────────────────────────────────────────── */

const pageStyle: React.CSSProperties = {
  maxWidth: 540,
  margin: '0 auto',
  padding: '2rem 1.5rem',
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 600,
  color: '#2a2a2a',
  marginBottom: '0.35rem',
  letterSpacing: '-0.01em',
};

const stepDescStyle: React.CSSProperties = {
  fontSize: '13.5px',
  color: '#888',
  marginBottom: '1.25rem',
  lineHeight: 1.5,
};

const optionStyle = (selected: boolean): React.CSSProperties => ({
  padding: '12px 16px',
  border: `1.5px solid ${selected ? '#a89870' : '#e5e3de'}`,
  borderRadius: '8px',
  background: selected ? '#faf8f4' : '#fff',
  cursor: 'pointer',
  marginBottom: '8px',
  transition: 'all 0.15s ease',
});

const optionLabelStyle: React.CSSProperties = {
  fontSize: '14.5px',
  fontWeight: 500,
  color: '#2a2a2a',
};

const optionDescStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: '#888',
  marginTop: '2px',
  lineHeight: 1.45,
};

const tagStyle = (selected: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '5px 14px',
  border: `1.5px solid ${selected ? '#a89870' : '#e5e3de'}`,
  borderRadius: '20px',
  background: selected ? '#faf8f4' : '#fff',
  cursor: 'pointer',
  marginRight: '6px',
  marginBottom: '6px',
  fontSize: '13.5px',
  fontWeight: 500,
  color: selected ? '#6b5d3e' : '#555',
  transition: 'all 0.15s ease',
});

const progressBarBg: React.CSSProperties = {
  height: 3,
  background: '#eee',
  borderRadius: 2,
  marginBottom: '2rem',
};

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '1.5rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  fontFamily: 'inherit',
  marginBottom: '10px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12.5px',
  fontWeight: 500,
  color: '#888',
  marginBottom: '3px',
};

/* ── Component ────────────────────────────────────────── */

export default function Onboarding() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    intent: null,
    experience: null,
    sonicPrefs: [],
    musicGenres: [],
    listeningStyle: null,
    roomSize: null,
    volume: null,
    hasSystem: null,
    system: { speakers: '', amplifier: '', dac: '', source: '' },
  });

  // Redirect unauthenticated users
  if (status === 'loading') return null;
  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return data.intent !== null;
      case 2: return data.experience !== null;
      case 3: return data.sonicPrefs.length > 0;
      case 4: return true; // all optional
      case 5: return true; // all optional
      case 6: return data.hasSystem !== null;
      case 7: return true; // review step
      default: return false;
    }
  };

  const toggleSonicPref = (key: string) => {
    setData((d) => {
      const prefs = d.sonicPrefs.includes(key)
        ? d.sonicPrefs.filter((k) => k !== key)
        : d.sonicPrefs.length < 2
          ? [...d.sonicPrefs, key]
          : d.sonicPrefs;
      return { ...d, sonicPrefs: prefs };
    });
  };

  const toggleGenre = (value: string) => {
    setData((d) => {
      const genres = d.musicGenres.includes(value)
        ? d.musicGenres.filter((g) => g !== value)
        : [...d.musicGenres, value];
      return { ...d, musicGenres: genres };
    });
  };

  const setSystemField = (field: keyof SystemInput, value: string) => {
    setData((d) => ({ ...d, system: { ...d.system, [field]: value } }));
  };

  /** Merge selected sonic prefs into axis-based preferences (4 system axes). */
  const buildAxisPreferences = (): Record<string, number> => {
    const axes: Record<string, number> = {
      warm_bright: 0, smooth_detailed: 0, elastic_controlled: 0, airy_closed: 0,
    };
    const selected = SONIC_OPTIONS.filter((o) => data.sonicPrefs.includes(o.key));
    if (selected.length === 0) return axes;
    for (const pref of selected) {
      for (const [axis, value] of Object.entries(pref.axisMapping)) {
        axes[axis] = (axes[axis] ?? 0) + value;
      }
    }
    // Clamp to -2..+2 range
    for (const k of Object.keys(axes)) {
      axes[k] = Math.max(-2, Math.min(2, axes[k]));
    }
    return axes;
  };

  const handleSubmit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const preferences = buildAxisPreferences();
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: data.intent,
          experienceLevel: data.experience,
          sonicPrefs: data.sonicPrefs,
          preferences,
          musicGenres: data.musicGenres,
          listeningStyle: data.listeningStyle,
          roomSize: data.roomSize,
          volume: data.volume,
          hasSystem: data.hasSystem,
          system: data.hasSystem ? data.system : null,
        }),
      });
      if (res.ok) {
        router.push('/');
      } else {
        console.error('Onboarding save failed', await res.text());
      }
    } finally {
      setSaving(false);
    }
  }, [data, saving, router]);

  /* ── Step renderers ───────────────────────────────── */

  const renderStep = () => {
    switch (step) {
      /* ── Step 1: Intent ─────────────────────────────── */
      case 1:
        return (
          <>
            <div style={stepTitleStyle}>What brings you here?</div>
            <div style={stepDescStyle}>This helps us focus our guidance.</div>
            {INTENT_OPTIONS.map((o) => (
              <div key={o.value}
                style={optionStyle(data.intent === o.value)}
                onClick={() => setData((d) => ({ ...d, intent: o.value }))}
              >
                <div style={optionLabelStyle}>{o.label}</div>
                <div style={optionDescStyle}>{o.desc}</div>
              </div>
            ))}
          </>
        );

      /* ── Step 2: Experience ─────────────────────────── */
      case 2:
        return (
          <>
            <div style={stepTitleStyle}>How would you describe your experience with hi-fi?</div>
            <div style={stepDescStyle}>This helps us calibrate depth and tone.</div>
            {EXPERIENCE_OPTIONS.map((o) => (
              <div key={o.value}
                style={optionStyle(data.experience === o.value)}
                onClick={() => setData((d) => ({ ...d, experience: o.value }))}
              >
                <div style={optionLabelStyle}>{o.label}</div>
                <div style={optionDescStyle}>{o.desc}</div>
              </div>
            ))}
          </>
        );

      /* ── Step 3: Sonic preferences ──────────────────── */
      case 3:
        return (
          <>
            <div style={stepTitleStyle}>What matters most to you in sound?</div>
            <div style={stepDescStyle}>
              Pick up to two. There are no wrong answers — this is a starting point.
            </div>
            {SONIC_OPTIONS.map((o) => (
              <div key={o.key}
                style={optionStyle(data.sonicPrefs.includes(o.key))}
                onClick={() => toggleSonicPref(o.key)}
              >
                <div style={optionLabelStyle}>{o.label}</div>
                <div style={optionDescStyle}>{o.desc}</div>
              </div>
            ))}
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
              {data.sonicPrefs.length}/2 selected
            </div>
          </>
        );

      /* ── Step 4: Music & Listening ──────────────────── */
      case 4:
        return (
          <>
            <div style={stepTitleStyle}>What do you listen to?</div>
            <div style={stepDescStyle}>Select any that apply. All optional.</div>

            <div style={{ marginBottom: '1.25rem' }}>
              {GENRE_OPTIONS.map((g) => (
                <span key={g.value}
                  style={tagStyle(data.musicGenres.includes(g.value))}
                  onClick={() => toggleGenre(g.value)}
                >
                  {g.label}
                </span>
              ))}
            </div>

            <div style={{ ...labelStyle, marginTop: '0.75rem', marginBottom: '8px' }}>
              How do you usually listen?
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {STYLE_OPTIONS.map((s) => (
                <span key={s.value}
                  style={tagStyle(data.listeningStyle === s.value)}
                  onClick={() => setData((d) => ({ ...d, listeningStyle: s.value }))}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </>
        );

      /* ── Step 5: Room & Volume ──────────────────────── */
      case 5:
        return (
          <>
            <div style={stepTitleStyle}>Your listening space</div>
            <div style={stepDescStyle}>This affects how we evaluate system balance. Skip if unsure.</div>

            <div style={{ ...labelStyle, marginBottom: '8px' }}>Room size</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {ROOM_OPTIONS.map((r) => (
                <span key={r.value}
                  style={tagStyle(data.roomSize === r.value)}
                  onClick={() => setData((d) => ({ ...d, roomSize: d.roomSize === r.value ? null : r.value }))}
                >
                  {r.label}
                </span>
              ))}
            </div>

            <div style={{ ...labelStyle, marginBottom: '8px' }}>Typical listening volume</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {VOLUME_OPTIONS.map((v) => (
                <span key={v.value}
                  style={tagStyle(data.volume === v.value)}
                  onClick={() => setData((d) => ({ ...d, volume: d.volume === v.value ? null : v.value }))}
                >
                  {v.label}
                </span>
              ))}
            </div>
          </>
        );

      /* ── Step 6: Current System ─────────────────────── */
      case 6:
        return (
          <>
            <div style={stepTitleStyle}>Do you have a system?</div>
            <div style={stepDescStyle}>
              If you do, we can assess it right away. If not, we&rsquo;ll start with general guidance.
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
              <div
                style={{ ...optionStyle(data.hasSystem === true), flex: 1, textAlign: 'center' }}
                onClick={() => setData((d) => ({ ...d, hasSystem: true }))}
              >
                <div style={optionLabelStyle}>Yes</div>
              </div>
              <div
                style={{ ...optionStyle(data.hasSystem === false), flex: 1, textAlign: 'center' }}
                onClick={() => setData((d) => ({ ...d, hasSystem: false }))}
              >
                <div style={optionLabelStyle}>Not yet</div>
              </div>
            </div>

            {data.hasSystem && (
              <div style={{ animation: 'fadeInUp 0.2s ease' }}>
                <div style={{ ...stepDescStyle, marginBottom: '0.75rem' }}>
                  Enter what you have. Leave blank anything you don&rsquo;t have or aren&rsquo;t sure about.
                </div>
                <label style={labelStyle}>Speakers</label>
                <input style={inputStyle} placeholder="e.g. KEF LS50 Meta"
                  value={data.system.speakers}
                  onChange={(e) => setSystemField('speakers', e.target.value)} />

                <label style={labelStyle}>Amplifier</label>
                <input style={inputStyle} placeholder="e.g. Naim Nait 5si"
                  value={data.system.amplifier}
                  onChange={(e) => setSystemField('amplifier', e.target.value)} />

                <label style={labelStyle}>DAC</label>
                <input style={inputStyle} placeholder="e.g. Schiit Bifrost"
                  value={data.system.dac}
                  onChange={(e) => setSystemField('dac', e.target.value)} />

                <label style={labelStyle}>Source</label>
                <input style={inputStyle} placeholder="e.g. Bluesound Node, turntable, streaming"
                  value={data.system.source}
                  onChange={(e) => setSystemField('source', e.target.value)} />
              </div>
            )}
          </>
        );

      /* ── Step 7: Review ─────────────────────────────── */
      case 7: {
        const selectedPrefs = SONIC_OPTIONS.filter((o) => data.sonicPrefs.includes(o.key));
        const intentLabel = INTENT_OPTIONS.find((o) => o.value === data.intent)?.label;
        const expLabel = EXPERIENCE_OPTIONS.find((o) => o.value === data.experience)?.label;
        return (
          <>
            <div style={stepTitleStyle}>Here&rsquo;s what we have</div>
            <div style={stepDescStyle}>
              You can change any of this later from your profile.
            </div>

            <div style={reviewSection}>
              <div style={reviewLabel}>Intent</div>
              <div style={reviewValue}>{intentLabel}</div>
            </div>
            <div style={reviewSection}>
              <div style={reviewLabel}>Experience</div>
              <div style={reviewValue}>{expLabel}</div>
            </div>
            <div style={reviewSection}>
              <div style={reviewLabel}>Sound preferences</div>
              <div style={reviewValue}>{selectedPrefs.map((p) => p.label).join(', ') || 'None selected'}</div>
            </div>
            {data.musicGenres.length > 0 && (
              <div style={reviewSection}>
                <div style={reviewLabel}>Music</div>
                <div style={reviewValue}>{data.musicGenres.join(', ')}</div>
              </div>
            )}
            {data.listeningStyle && (
              <div style={reviewSection}>
                <div style={reviewLabel}>Listening style</div>
                <div style={reviewValue}>{data.listeningStyle}</div>
              </div>
            )}
            {data.roomSize && (
              <div style={reviewSection}>
                <div style={reviewLabel}>Room</div>
                <div style={reviewValue}>
                  {ROOM_OPTIONS.find((r) => r.value === data.roomSize)?.label}
                  {data.volume ? ` · ${data.volume} volume` : ''}
                </div>
              </div>
            )}
            {data.hasSystem && (
              <div style={reviewSection}>
                <div style={reviewLabel}>System</div>
                <div style={reviewValue}>
                  {[data.system.speakers, data.system.amplifier, data.system.dac, data.system.source]
                    .filter(Boolean)
                    .join(' → ') || 'No components entered'}
                </div>
              </div>
            )}
            {data.hasSystem === false && (
              <div style={reviewSection}>
                <div style={reviewLabel}>System</div>
                <div style={reviewValue}>No system yet — starting fresh</div>
              </div>
            )}
          </>
        );
      }

      default:
        return null;
    }
  };

  /* ── Render ─────────────────────────────────────────── */

  const progress = step / TOTAL_STEPS;

  return (
    <div style={pageStyle}>
      {/* Progress bar */}
      <div style={progressBarBg}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: '#a89870',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Step content */}
      {renderStep()}

      {/* Navigation */}
      <div style={navRowStyle}>
        {step > 1 ? (
          <button className="btn btn-sm"
            onClick={() => setStep((s) => s - 1)}
            style={{ opacity: 0.7 }}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        {step < TOTAL_STEPS ? (
          <button className="btn btn-primary"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
            style={{ opacity: canAdvance() ? 1 : 0.4 }}
          >
            Continue →
          </button>
        ) : (
          <button className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Get started →'}
          </button>
        )}
      </div>

      {/* Skip link for optional steps */}
      {(step === 4 || step === 5) && (
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <span
            style={{ fontSize: '12.5px', color: '#aaa', cursor: 'pointer' }}
            onClick={() => setStep((s) => s + 1)}
          >
            Skip this step
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Review step styles ───────────────────────────────── */

const reviewSection: React.CSSProperties = {
  padding: '8px 0',
  borderBottom: '1px solid #f0eee8',
};

const reviewLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#999',
  marginBottom: '2px',
};

const reviewValue: React.CSSProperties = {
  fontSize: '14px',
  color: '#333',
};
