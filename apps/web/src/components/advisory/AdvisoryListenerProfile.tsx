/**
 * Structured listener taste profile display.
 *
 * Three tiers:
 *   - Primary traits: dominant sonic preferences
 *   - Secondary traits: present but less dominant
 *   - Avoided traits: tendencies the listener de-emphasizes
 *
 * Optional philosophy prose and keyObservation opening context.
 * Uses the Audio XX accent palette for badge styling.
 */

import { renderText } from './render-text';

interface ListenerProfileProps {
  profile: {
    primaryTraits: string[];
    secondaryTraits?: string[];
    avoided?: string[];
    philosophy?: string;
  };
  keyObservation?: string;
}

type BadgeVariant = 'primary' | 'secondary' | 'avoided';

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  primary: { bg: '#f5f2ea', color: '#5a5030', border: '#e0d8c0' },
  secondary: { bg: '#f8f8f5', color: '#777060', border: '#e8e4d8' },
  avoided: { bg: '#faf7f4', color: '#8a6a50', border: '#e8dcd0' },
};

function TraitBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  const s = BADGE_STYLES[variant];
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.55rem',
      fontSize: '0.82rem',
      fontWeight: 500,
      borderRadius: '4px',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      marginRight: '0.35rem',
      marginBottom: '0.3rem',
    }}>
      {label}
    </span>
  );
}

export default function AdvisoryListenerProfile({ profile, keyObservation }: ListenerProfileProps) {
  return (
    <div style={{ lineHeight: 1.7 }}>
      {/* Opening context from key observation */}
      {keyObservation && (
        <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.95rem', color: '#444' }}>
          {renderText(keyObservation)}
        </p>
      )}

      {/* Primary traits */}
      {profile.primaryTraits.length > 0 && (
        <div style={{ marginBottom: '0.7rem' }}>
          <div style={{
            fontSize: '0.73rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: '#1F3A5F',
            marginBottom: '0.4rem',
          }}>
            Primary traits
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem' }}>
            {profile.primaryTraits.map((t, i) => (
              <TraitBadge key={i} label={t} variant="primary" />
            ))}
          </div>
        </div>
      )}

      {/* Secondary traits */}
      {profile.secondaryTraits && profile.secondaryTraits.length > 0 && (
        <div style={{ marginBottom: '0.7rem' }}>
          <div style={{
            fontSize: '0.73rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: '#aaa',
            marginBottom: '0.4rem',
          }}>
            Secondary traits
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem' }}>
            {profile.secondaryTraits.map((t, i) => (
              <TraitBadge key={i} label={t} variant="secondary" />
            ))}
          </div>
        </div>
      )}

      {/* Avoided traits */}
      {profile.avoided && profile.avoided.length > 0 && (
        <div style={{ marginBottom: '0.7rem' }}>
          <div style={{
            fontSize: '0.73rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: '#bbb',
            marginBottom: '0.4rem',
          }}>
            Traits typically avoided
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem' }}>
            {profile.avoided.map((t, i) => (
              <TraitBadge key={i} label={t} variant="avoided" />
            ))}
          </div>
        </div>
      )}

      {/* Philosophy prose */}
      {profile.philosophy && (
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: '0.93rem',
          fontStyle: 'italic',
          color: '#777',
          lineHeight: 1.7,
        }}>
          {renderText(profile.philosophy)}
        </p>
      )}
    </div>
  );
}
