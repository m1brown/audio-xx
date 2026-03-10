'use client';

import { PROFILE_TRAITS, type TasteProfile, type ProfileTraitKey } from '@/lib/taste-profile';
import TasteRadar from './TasteRadar';

interface TasteProfileEditorProps {
  profile: TasteProfile;
  onChange: (profile: TasteProfile) => void;
}

/**
 * Full taste-profile editor: live radar preview + 7 trait sliders.
 *
 * Matches the existing profile page styling (maxWidth 520, .field pattern).
 * Manual edits set confidence to at least 0.5.
 */
export default function TasteProfileEditor({ profile, onChange }: TasteProfileEditorProps) {
  function handleSliderChange(key: ProfileTraitKey, rawValue: number) {
    const value = Math.round(rawValue) / 100; // 0–100 → 0–1
    const newTraits = { ...profile.traits, [key]: value };
    const hasAny = Object.values(newTraits).some((v) => v > 0);
    onChange({
      traits: newTraits,
      confidence: hasAny ? Math.max(profile.confidence, 0.5) : 0,
      lastUpdated: new Date().toISOString(),
    });
  }

  return (
    <div style={{ maxWidth: 520 }}>
      {/* Live radar preview */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
        <TasteRadar profile={profile} size={240} />
      </div>

      {/* Trait sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {PROFILE_TRAITS.map((trait) => {
          const pct = Math.round(profile.traits[trait.key] * 100);
          return (
            <div key={trait.key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.2rem',
                }}
              >
                <label
                  htmlFor={`taste-${trait.key}`}
                  style={{ fontSize: '0.92rem', fontWeight: 500, color: trait.color }}
                >
                  {trait.label}
                </label>
                <span style={{ fontSize: '0.82rem', color: '#888', minWidth: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>
              <input
                id={`taste-${trait.key}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                onChange={(e) => handleSliderChange(trait.key, Number(e.target.value))}
                style={{ width: '100%', accentColor: trait.color }}
              />
              <div style={{ fontSize: '0.78rem', color: '#999', marginTop: '0.1rem' }}>
                {trait.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
