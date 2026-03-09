'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TasteProfileEditor from '@/components/TasteProfileEditor';
import { createEmptyProfile, parseTasteProfile, type TasteProfile } from '@/lib/taste-profile';

const ARCHETYPES = ['engagement', 'composure', 'low_volume'] as const;
const SENSITIVITY_FLAGS = ['fatigue_sensitive', 'glare_sensitive', 'bass_sensitive', 'volume_sensitive'] as const;

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState({
    roomSize: '',
    roomType: '',
    listeningLevel: '',
    archetypes: [] as string[],
    sensitivityFlags: [] as string[],
    notes: '',
  });
  const [tasteProfile, setTasteProfile] = useState<TasteProfile>(createEmptyProfile());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/profile').then((r) => r.json()).then((p) => {
        setProfile({
          roomSize: p.roomSize || '',
          roomType: p.roomType || '',
          listeningLevel: p.listeningLevel || '',
          archetypes: p.archetypes || [],
          sensitivityFlags: p.sensitivityFlags || [],
          notes: p.notes || '',
        });
        setTasteProfile(parseTasteProfile(p.preferredTraits));
      });
    }
  }, [status, router]);

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  async function handleSave() {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, preferredTraits: tasteProfile }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (status !== 'authenticated') return null;

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>Listening profile</h1>
      <p className="small muted mb-2">Shapes how the engine prioritizes traits and surfaces warnings.</p>

      <h2>Archetypes</h2>
      <p className="small muted mb-1">Select the listening archetypes that resonate with you.</p>
      <div className="mb-1">
        {ARCHETYPES.map((a) => (
          <button
            key={a}
            className={`tag ${profile.archetypes.includes(a) ? 'tag-active' : ''}`}
            onClick={() => setProfile({ ...profile, archetypes: toggleArray(profile.archetypes, a) })}
          >
            {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      {profile.archetypes.includes('engagement') && profile.archetypes.includes('composure') && (
        <p className="small warning mb-1">
          Engagement and composure are in tension. Improving one typically reduces the other.
        </p>
      )}

      <hr />

      <h2>Sensitivity flags</h2>
      <div className="mb-1">
        {SENSITIVITY_FLAGS.map((f) => (
          <button
            key={f}
            className={`tag ${profile.sensitivityFlags.includes(f) ? 'tag-active' : ''}`}
            onClick={() => setProfile({ ...profile, sensitivityFlags: toggleArray(profile.sensitivityFlags, f) })}
          >
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <hr />

      <h2>Taste profile</h2>
      <p className="small muted mb-1">
        Adjust sliders to reflect what you value in a listening experience. This shapes how the engine weighs recommendations.
      </p>
      <div className="mb-1">
        <TasteProfileEditor profile={tasteProfile} onChange={setTasteProfile} />
      </div>

      <hr />

      <h2>Room and listening context</h2>
      <div className="field">
        <label>Room size</label>
        <select value={profile.roomSize} onChange={(e) => setProfile({ ...profile, roomSize: e.target.value })}>
          <option value="">Not specified</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      <div className="field">
        <label>Room type</label>
        <select value={profile.roomType} onChange={(e) => setProfile({ ...profile, roomType: e.target.value })}>
          <option value="">Not specified</option>
          <option value="dedicated">Dedicated listening room</option>
          <option value="living_room">Living room</option>
          <option value="bedroom">Bedroom</option>
          <option value="office">Office / study</option>
        </select>
      </div>
      <div className="field">
        <label>Typical listening level</label>
        <select value={profile.listeningLevel} onChange={(e) => setProfile({ ...profile, listeningLevel: e.target.value })}>
          <option value="">Not specified</option>
          <option value="low">Low (apartment, night listening)</option>
          <option value="moderate">Moderate</option>
          <option value="loud">Loud</option>
          <option value="varies">Varies</option>
        </select>
      </div>

      <hr />

      <h2>Notes</h2>
      <p className="small muted mb-1">Anything else the engine should know about your preferences.</p>
      <div className="field">
        <textarea
          value={profile.notes}
          onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
          placeholder="e.g. I value musicality over accuracy. I listen mostly to jazz and classical."
        />
      </div>

      <button onClick={handleSave} className="btn btn-primary">
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
