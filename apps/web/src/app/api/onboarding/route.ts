import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

/**
 * POST /api/onboarding
 *
 * Saves onboarding data to the user's profile and optionally creates
 * a first system from free-text component names.
 *
 * Preferences are stored as axis-based JSON (the 4 system axes):
 *   { warm_bright, smooth_detailed, elastic_controlled, airy_closed }
 * The 7-trait taste profile is NOT populated here — it evolves
 * through conversation and explicit profile editing.
 */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    intent,
    experienceLevel,
    preferences,       // axis-based JSON: { warm_bright, smooth_detailed, ... }
    sonicPrefs,        // raw selection keys for reference
    musicGenres,
    listeningStyle,
    roomSize,
    volume,
    hasSystem,
    system,
  } = body;

  // ── Build preferences JSON (axes + raw selections) ───────────
  const preferencesJson = JSON.stringify({
    axes: preferences ?? {},
    selections: sonicPrefs ?? [],
  });

  // ── Detect locale from Accept-Language header ────────────────
  const acceptLang = req.headers.get('accept-language') ?? '';
  const langMatch = acceptLang.match(/^([a-z]{2})(?:-([A-Z]{2}))?/);
  const locale = langMatch
    ? JSON.stringify({ language: langMatch[1], region: langMatch[2] ?? null })
    : JSON.stringify({ language: 'en', region: null });

  // ── Map room size to existing profile field ──────────────────
  const mappedRoomSize = roomSize === 'nearfield' ? 'small' : roomSize;

  try {
    // ── Upsert profile with onboarding data ──────────────────────
    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        intent: intent ?? null,
        experienceLevel: experienceLevel ?? null,
        preferredTraits: preferencesJson,
        musicGenres: JSON.stringify(musicGenres ?? []),
        listeningStyle: listeningStyle ?? null,
        roomSize: mappedRoomSize ?? null,
        listeningLevel: volume ?? null,
        locale,
        onboardedAt: new Date(),
      },
      update: {
        intent: intent ?? undefined,
        experienceLevel: experienceLevel ?? undefined,
        preferredTraits: preferencesJson,
        musicGenres: musicGenres ? JSON.stringify(musicGenres) : undefined,
        listeningStyle: listeningStyle ?? undefined,
        roomSize: mappedRoomSize ?? undefined,
        listeningLevel: volume ?? undefined,
        locale,
        onboardedAt: new Date(),
      },
    });

    // ── Create initial system if user provided components ────────
    if (hasSystem && system) {
      const { speakers, amplifier, dac, source } = system as Record<string, string>;
      const parts = [
        { raw: speakers, category: 'speakers' },
        { raw: amplifier, category: 'amplifier' },
        { raw: dac, category: 'dac' },
        { raw: source, category: 'streamer' },
      ].filter((p) => p.raw?.trim());

      if (parts.length > 0) {
        // Build raw_input for fallback reference
        const rawInput = [speakers, amplifier, dac, source].filter(Boolean).join(' → ');

        const sys = await prisma.system.create({
          data: {
            userId,
            name: 'My System',
            notes: rawInput ? `Raw input: ${rawInput}` : 'Created during onboarding.',
            primaryUse: listeningStyle === 'focused' ? 'critical listening' : listeningStyle === 'background' ? 'background music' : null,
          },
        });

        for (const part of parts) {
          const trimmed = part.raw.trim();
          const spaceIdx = trimmed.indexOf(' ');
          const brand = spaceIdx > 0 ? trimmed.slice(0, spaceIdx) : trimmed;
          const name = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1) : trimmed;

          // Find existing catalog entry or create user-submitted component
          let component = await prisma.component.findFirst({
            where: { brand: { equals: brand }, name: { equals: name }, category: part.category },
          });

          if (!component) {
            component = await prisma.component.create({
              data: {
                name,
                brand,
                category: part.category,
                confidenceLevel: 'user',
                userSubmitted: true,
              },
            });
          }

          await prisma.systemComponent.create({
            data: {
              systemId: sys.id,
              componentId: component.id,
              actionLog: JSON.stringify([{ action: 'added', timestamp: new Date().toISOString() }]),
            },
          });
        }

        // Set as active system
        await prisma.profile.update({
          where: { userId },
          data: { activeSystemId: sys.id },
        });
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[api/onboarding] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
