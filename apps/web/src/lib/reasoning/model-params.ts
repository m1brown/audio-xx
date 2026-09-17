/**
 * Generation-parameter compatibility (M1 astra promotion, 2026-09-17).
 *
 * Transport/config compatibility ONLY — no behavioral branches, no
 * model-specific prompts. The gpt-4 family keeps the route's historical
 * temperature 0.4; every other model (gpt-6-astra included) runs at the
 * API default, exactly as the winning model-selection arm did. Reasoning
 * models can reject a non-default temperature outright, so sending it
 * would turn every founder turn into an upstream error.
 */
export function generationParams(model: string): { temperature?: number } {
  return /^gpt-4/.test(model) ? { temperature: 0.4 } : {};
}
