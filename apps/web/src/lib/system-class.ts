/**
 * System class — classify an active system as consumer-wireless vs
 * traditional audiophile, so the advisory layer can swap in remediation
 * copy that actually applies to the user's gear.
 *
 * Audio XX Playbook alignment:
 *   - §3 Preference protection — do not give "move the speakers closer to
 *     the rear wall" advice to someone running a Sonos. Fixed-driver
 *     wireless speakers have no user-placement latitude.
 *   - §2 Trade-off discipline — consumer systems have different failure
 *     modes (scale ceiling, WiFi interference) than traditional chains
 *     (room placement, ground loops).
 *
 * Boundary decision (per CLAUDE.md §8):
 *   - PURE domain mapping table. No engine vocabulary. No axis scoring.
 *   - Consumed by advisory-response adapters and consultation wiring;
 *     never by the rule engine itself.
 *   - Climate-Screen test: the CLASSIFIER function is portable (it takes
 *     a list of component brands and returns a class label). Only the
 *     brand set is audio-specific — which is fine for an adapter.
 */

// ── Consumer / lifestyle / mainstream-tech brands ─────
//
// These brands dominate general-consumer audio (wireless speakers,
// phones, voice assistants, lifestyle audio). When a user's system is
// made up solely of these, traditional audiophile remediation
// (speaker placement, interconnect grounding, tube rolling) does not
// apply and the advisor must route to a different copy variant.
const CONSUMER_BRANDS: ReadonlySet<string> = new Set([
  'sonos',
  'bose',
  'apple',
  'iphone',
  'ipad',
  'ipod',
  'airpods',
  'airpod',
  'homepod',
  'google',
  'nest',
  'amazon',
  'alexa',
  'echo',
  'beats',
  'jbl',
  'harman kardon',
  'bang & olufsen',
  'b&o',
  'sony',
  'samsung',
  'lg',
]);

/** Brands that identify a specific consumer-wireless SPEAKER (not a source). */
const CONSUMER_SPEAKER_BRANDS: ReadonlySet<string> = new Set([
  'sonos', 'bose', 'homepod', 'echo', 'nest', 'jbl', 'beats',
]);

/** Brands / devices that identify a CONSUMER SOURCE (phone, tablet, streaming box). */
const CONSUMER_SOURCE_BRANDS: ReadonlySet<string> = new Set([
  'iphone', 'ipad', 'ipod', 'airpods', 'airpod', 'apple', 'google', 'samsung',
]);

export type SystemClass =
  | 'audiophile'        // traditional component chain
  | 'consumer_wireless' // Sonos / Bose / HomePod / phone only
  | 'mixed'             // some of each
  | 'unknown';

export interface SystemComponentLite {
  brand?: string;
  name?: string;
}

function norm(s?: string): string {
  return (s ?? '').trim().toLowerCase();
}

function isConsumerBrand(brand?: string): boolean {
  const b = norm(brand);
  if (!b) return false;
  if (CONSUMER_BRANDS.has(b)) return true;
  // Handle short prefix matches like "b&o" already in the set; otherwise
  // test token-by-token so "Apple iPhone" → apple (consumer).
  const first = b.split(/\s+/)[0];
  return CONSUMER_BRANDS.has(first);
}

/**
 * Classify an active system by the provenance of its components.
 *
 * Pure function — safe for any caller (adapters, consultation wiring,
 * or the page-orchestrator).
 */
export function classifySystemClass(components: SystemComponentLite[] | undefined | null): SystemClass {
  if (!components || components.length === 0) return 'unknown';

  let consumerHits = 0;
  let otherHits = 0;
  for (const c of components) {
    if (isConsumerBrand(c.brand) || isConsumerBrand(c.name)) {
      consumerHits++;
    } else if (c.brand || c.name) {
      otherHits++;
    }
  }

  if (consumerHits === 0 && otherHits === 0) return 'unknown';
  if (consumerHits > 0 && otherHits === 0) return 'consumer_wireless';
  if (consumerHits === 0 && otherHits > 0) return 'audiophile';
  return 'mixed';
}

/**
 * Convenience: accept a list of free-text component strings (e.g.
 * "Sonos Arc", "iPhone 14", "Rega Planar 3") and classify. Used by
 * advisory-response.ts where ShoppingAdvisoryContext.systemComponents
 * is string[] rather than structured components.
 */
export function classifySystemFromStrings(componentStrings: string[] | undefined | null): SystemClass {
  if (!componentStrings || componentStrings.length === 0) return 'unknown';
  const lite: SystemComponentLite[] = componentStrings.map((s) => {
    const trimmed = s.trim();
    const firstToken = trimmed.split(/\s+/)[0] ?? '';
    return { brand: firstToken, name: trimmed };
  });
  return classifySystemClass(lite);
}

/** Role inference for a single consumer component. */
export function inferConsumerRole(component: SystemComponentLite): 'speaker' | 'source' | 'accessory' | 'unknown' {
  const b = norm(component.brand);
  const n = norm(component.name);
  if (CONSUMER_SPEAKER_BRANDS.has(b) || CONSUMER_SPEAKER_BRANDS.has(n.split(/\s+/)[0])) return 'speaker';
  if (CONSUMER_SOURCE_BRANDS.has(b) || CONSUMER_SOURCE_BRANDS.has(n.split(/\s+/)[0])) return 'source';
  if (b === 'airpods' || n.includes('airpod')) return 'accessory';
  return 'unknown';
}

// ── Remediation copy for consumer-wireless systems ────
//
// Copy block returned by the adapter when the rule engine fires a
// thinness / electrical-noise rule on a consumer_wireless chain. The
// original audiophile-chain advice ("move the speakers six inches
// closer to the rear wall", "lift components to break a ground loop")
// does not apply — fixed-driver wireless speakers have no placement
// latitude and wireless sources have no grounded interconnects.

export interface ConsumerRemediation {
  explanation: string;
  suggestions: string[];
  nextStep: string;
}

export function consumerThinnessRemediation(): ConsumerRemediation {
  return {
    explanation:
      'Lifestyle wireless speakers (Sonos, HomePod, Bose, etc.) ship with fixed drivers '
      + 'in a sealed enclosure and apply automatic room correction. The "tiny" or '
      + '"bass-light" quality you hear is a function of the speaker\'s size class — '
      + 'not something that room placement or cable changes can recover.',
    suggestions: [
      'If you want real scale and bass, the usual paths are: step up to a larger model '
        + '(Sonos Arc, HomePod 2 pair, Sonos Five) or move to a stereo pair with a compact '
        + 'integrated amp.',
      'Make sure Trueplay / room-correction is actually on and ran in the current room — '
        + 'running it from a different room leaves the speaker tuned for the wrong space.',
    ],
    nextStep:
      'Decide whether you want to stay in the wireless lifestyle lane (bigger model or a '
      + 'stereo pair of the same speaker) or move to a traditional stereo setup — each has '
      + 'different cost and simplicity trade-offs.',
  };
}

export function consumerElectricalNoiseRemediation(): ConsumerRemediation {
  return {
    explanation:
      'On a wireless speaker chain, audible noise is almost always network-side '
      + '(WiFi congestion or RF interference between devices) or source-side '
      + '(a specific app or streaming service delivering a lossy or distorted signal). '
      + 'The speaker itself has very few electrical conditions that can introduce noise, '
      + 'so isolating the signal path is the fastest way to identify the cause.',
    suggestions: [
      'Check whether the noise is tied to one source: does it happen on every app '
        + '(Spotify, Apple Music, AirPlay from your phone) or only one? That isolates '
        + 'network vs source.',
      'Check WiFi strength near the speaker and whether a 2.4 GHz device (microwave, '
        + 'baby monitor, older router) is nearby — Sonos and similar speakers share that '
        + 'band and are sensitive to congestion.',
    ],
    nextStep:
      'Change one variable at a time — swap sources, then swap to a wired Ethernet '
      + 'connection if the speaker supports it — and note when the noise disappears. That '
      + 'tells you whether it is the network, the source, or the speaker itself.',
  };
}

/** First-contact system assessment copy for consumer-only chains. */
export function consumerSystemIntro(
  components: SystemComponentLite[],
): { systemSignature: string; philosophy: string; tendencies: string; systemContext: string } {
  const roles = components.map((c) => ({ c, role: inferConsumerRole(c) }));
  const speakers = roles.filter((r) => r.role === 'speaker').map((r) => r.c);
  const sources = roles.filter((r) => r.role === 'source').map((r) => r.c);

  const speakerLabel = speakers.length > 0
    ? speakers.map((s) => s.brand || s.name).join(' + ')
    : null;
  const sourceLabel = sources.length > 0
    ? sources.map((s) => s.brand || s.name).join(' + ')
    : null;

  const chain = [speakerLabel, sourceLabel].filter(Boolean).join(' driven from your ');

  return {
    systemSignature:
      chain
        ? `A ${chain} — a wireless lifestyle system optimized for simplicity and whole-home use.`
        : 'A wireless lifestyle audio system.',
    philosophy:
      'Lifestyle wireless systems prioritize convenience, multi-room control, and a '
      + 'no-setup listening experience. The speaker handles amplification, DAC, room '
      + 'correction, and streaming internally, which trades fine-grained tuning for a '
      + 'consistent out-of-the-box result.',
    tendencies:
      'Typical strengths: easy setup, reliable streaming, strong voice / podcast '
      + 'intelligibility, and consistent room-to-room volume. Typical ceilings: '
      + 'limited dynamic scale, compressed bass extension on small units, and little '
      + 'benefit from cable or component swaps.',
    systemContext:
      'Works well for background listening, casual music throughout the home, and '
      + 'podcast / TV use. Less suited to critical or high-volume listening where '
      + 'scale, dynamics, and bass extension matter.',
  };
}
