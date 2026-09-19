/**
 * Listener-observation detection (Migration 1 §3; widened 2026-09-19).
 *
 * Deliberately conservative and STRUCTURAL: a first-person, non-question
 * statement carrying situational/experiential vocabulary. Matches are
 * stored VERBATIM — no inference, no durable-preference promotion, no new
 * ontology. Missed observations still travel to the model in raw history;
 * this list exists so listener-stated facts survive beyond the raw-turn
 * window and reach the governed context as their own kind of ground
 * (LISTENER OBSERVATIONS — their words), which the reasoning rules treat
 * as the listener's evidence, never as product fact.
 *
 * The 2026-09-19 widening adds two families the original vocabulary
 * missed, both high-value listener evidence (Grok-parity mission):
 *
 *   stated preference/aversion — "I value sweetness, flow and air",
 *   "I don't like glare or excessive damping". Preference words alone do
 *   not match (structure still required); the sonic vocabulary carries it.
 *
 *   prior/reference systems — "my previous system was a Scott 222B with
 *   Hornshoppe Horns", "I used to own Boenicke W5s". What a listener kept
 *   and loved is evidence about the listener, not about the products.
 */
export function isListenerObservation(text: string): boolean {
  const t = text.trim();
  if (!t || t.endsWith('?') || t.length > 300) return false;
  if (!/\b(?:i|my|our|we)\b/i.test(t)) return false;
  return (
    // Situational / experiential (original vocabulary).
    /\b(?:sit|sitting|seat|listen|hear|hearing|find|prefer|room|feet|foot|meters?|metres?|level|volume|loud|quiet|softly|bright|harsh|strain|strained|compress\w*|soft|thin|boomy|fatigu\w*|desk|night|apartment)\b/i.test(t)
    // Stated preference / aversion carrying sonic vocabulary.
    || (/\b(?:value|love|like|enjoy|want|care|dislike|hate|avoid|miss)\b/i.test(t)
      && /\b(?:sweet\w*|flow|elastic\w*|detail\w*|air\w*|sparkl\w*|glare|damp\w*|warm\w*|lean|dry|tone|tonal|timbre|texture|body|bass|treble|midrange|imaging|soundstage|dynamics?|intimac\w*|resolution)\b/i.test(t))
    // Prior / reference systems the listener owned or kept.
    || /\b(?:previous|former|old|reference)\s+(?:system|setup|rig)\b|\bused\s+to\s+(?:own|have|run|use)\b|\b(?:i|we)\s+owned\b/i.test(t)
  );
}
