/**
 * Quick Recommendation — compact structured output for the onboarding flow.
 *
 * When a user completes the music → category → budget/preference sequence,
 * this module transforms a full shopping AdvisoryResponse into the compact
 * QuickRecommendation format: summary + 2–3 options + follow-up question.
 *
 * The shopping pipeline still runs (for product matching and reasoning),
 * but the output is stripped to the essentials.
 */

import type { AdvisoryResponse, QuickRecommendation, QuickRecOption } from './advisory-response';

/**
 * Extracts a compact QuickRecommendation from a full shopping advisory.
 * Returns null if the advisory doesn't have enough options to work with.
 */
export function extractQuickRecommendation(
  advisory: AdvisoryResponse,
  category: string,
  userSummary: string,
): QuickRecommendation | null {
  const options = advisory.options;
  if (!options || options.length === 0) return null;

  // Take at most 3 options
  const selected = options.slice(0, 3);

  const quickOptions: QuickRecOption[] = selected.map((opt) => {
    // Build 2–3 simple bullets from available data
    const bullets: string[] = [];

    // Sound character bullet
    if (opt.character) {
      bullets.push(opt.character);
    } else if (opt.soundProfile && opt.soundProfile.length > 0) {
      bullets.push(opt.soundProfile[0]);
    }

    // Fit / use case bullet
    if (opt.fitNote) {
      bullets.push(opt.fitNote);
    }

    // Price bullet if available
    if (opt.price) {
      const currency = opt.priceCurrency === 'USD' || !opt.priceCurrency ? '$' : opt.priceCurrency;
      bullets.push(`${currency}${opt.price.toLocaleString()}`);
    }

    // Ensure at least 2 bullets
    if (bullets.length < 2 && opt.standoutFeatures && opt.standoutFeatures.length > 0) {
      bullets.push(opt.standoutFeatures[0]);
    }

    // Cap at 3
    const finalBullets = bullets.slice(0, 3);

    return {
      name: opt.brand ? `${opt.brand} ${opt.name}` : opt.name,
      direction: opt.sonicDirectionLabel || opt.directionLabel || inferDirection(opt),
      bullets: finalBullets,
    };
  });

  // Build the follow-up question
  const followUp = buildFollowUp(quickOptions, category);

  return {
    summary: userSummary,
    options: quickOptions,
    followUp,
  };
}

/**
 * Builds a QuickRecommendation directly from an onboarding context
 * (without needing a full shopping advisory to extract from).
 */
export function buildQuickRecommendation(
  summary: string,
  options: QuickRecOption[],
  category: string,
): QuickRecommendation {
  return {
    summary,
    options: options.slice(0, 3),
    followUp: buildFollowUp(options, category),
  };
}

/** Infer a short direction label from an option's data. */
function inferDirection(opt: { character?: string; fitNote?: string; sonicDirectionLabel?: string }): string {
  if (opt.sonicDirectionLabel) return opt.sonicDirectionLabel;
  if (opt.character) {
    // Try to extract a direction from the character description
    const lower = opt.character.toLowerCase();
    if (lower.includes('warm') || lower.includes('smooth')) return 'Warm and musical';
    if (lower.includes('detail') || lower.includes('precise') || lower.includes('analytical')) return 'Detailed and precise';
    if (lower.includes('energy') || lower.includes('dynamic') || lower.includes('punch')) return 'Energetic and dynamic';
    if (lower.includes('neutral') || lower.includes('balanced')) return 'Balanced and neutral';
    if (lower.includes('bass') || lower.includes('impact')) return 'Bass and impact';
    if (lower.includes('open') || lower.includes('spacious') || lower.includes('airy')) return 'Open and spacious';
  }
  return 'Alternative direction';
}

/** Build a directional follow-up question based on the options presented. */
function buildFollowUp(options: QuickRecOption[], category: string): string {
  if (options.length < 2) {
    return `Would you like to explore more ${category} options, or does this direction feel right?`;
  }

  // Extract the distinct directions from the options
  const directions = options.map((o) => o.direction.toLowerCase());

  // If we can identify clear contrasts, ask about them
  const hasWarm = directions.some((d) => d.includes('warm') || d.includes('musical') || d.includes('smooth'));
  const hasEnergy = directions.some((d) => d.includes('energy') || d.includes('dynamic') || d.includes('punch') || d.includes('impact'));
  const hasDetail = directions.some((d) => d.includes('detail') || d.includes('precise') || d.includes('neutral') || d.includes('balanced'));

  if (hasWarm && hasEnergy) {
    return 'Do any of these directions feel closer to what you want? I can refine from there.';
  }
  if (hasWarm && hasDetail) {
    return 'Are you leaning more toward warmth and musicality, or clarity and precision?';
  }
  if (hasEnergy && hasDetail) {
    return 'Are you leaning more toward energy and excitement, or accuracy and balance?';
  }

  return 'Do any of these feel closer to what you\'re after? I can narrow it down.';
}

/**
 * Attach a QuickRecommendation to an existing AdvisoryResponse.
 * The quick-rec fields are populated; the renderer decides which format to show.
 */
export function attachQuickRecommendation(
  advisory: AdvisoryResponse,
  category: string,
  userSummary: string,
): AdvisoryResponse {
  const quickRec = extractQuickRecommendation(advisory, category, userSummary);
  if (!quickRec) return advisory;
  return {
    ...advisory,
    quickRecommendation: quickRec,
  };
}
