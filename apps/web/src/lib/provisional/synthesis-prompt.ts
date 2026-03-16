/**
 * Synthesis Prompt — LLM-facing prompt template for producing
 * ProvisionalProduct records from curated evidence.
 *
 * This module takes a sufficient EvidenceRecord and generates a
 * structured prompt that instructs the LLM to produce a complete
 * ProvisionalProduct. The output is a deterministic JSON schema
 * that can be validated before insertion into the provisional store.
 *
 * ── Design principles ─────────────────────────────────────────
 *
 *   1. The prompt is self-contained — the LLM receives all context
 *      it needs (evidence, axis definitions, output schema) in one shot.
 *   2. Guardrails are embedded in the prompt, not enforced externally.
 *   3. The output schema matches ProvisionalProduct exactly.
 *   4. No verbatim copying — the prompt explicitly forbids it.
 *   5. Axis calibration anchors are included so the LLM can position
 *      the product relative to known references.
 */

import type { EvidenceRecord, EvidenceSource, SonicObservation } from '../evidence/types';
import { buildReviewerCalibrationNote, findReviewersByPublication } from '../evidence/reviewers';

// ── Axis calibration anchors ────────────────────────
//
// These give the LLM reference points for positioning products
// on the four Audio XX axes. Each pole has an anchor product.

const AXIS_ANCHORS = `
## Axis Calibration Anchors

Position the product on each axis relative to these reference points.

### warm_bright (Warm ↔ Bright)
- Warm pole: Denafrips Pontus — harmonically dense, tonal richness, R2R warmth
- Neutral: Chord Qutest — clarity via timing precision, not treble emphasis
- Neutral: RME ADI-2 — ruler-flat transparency, measurement-oriented
- Bright pole: SMSL DO300 — ESS glare risk, lean tonal density

IMPORTANT: Clarity ≠ Brightness. A product that achieves detail through timing
accuracy or transparency is NEUTRAL, not bright. Brightness means treble emphasis
or tonal energy shifted toward upper frequencies.

### smooth_detailed (Smooth ↔ Detailed)
- Smooth pole: products with relaxed, grain-free presentation that prioritize flow over resolution
- Neutral: balanced retrieval without either smoothing over or spotlighting micro-information
- Detailed pole: products that spotlight micro-information and inner texture, sometimes at the cost of flow

### elastic_controlled (Elastic ↔ Controlled)
- Elastic pole: dynamically expressive, rhythmic, responsive to musical dynamics
- Neutral: balanced dynamic behavior — neither notably expressive nor notably rigid
- Controlled pole: composed, authoritative grip, high current delivery, stable under load

### airy_closed (Airy ↔ Closed)
- Airy pole: open, spacious staging with depth layering and air between images
- Neutral: moderate spatial presentation — neither notably open nor notably intimate
- Closed pole: focused, intimate presentation with near-field imaging
`;

// ── Trait definitions ────────────────────────────────

const TRAIT_DEFINITIONS = `
## Numeric Trait Scores (0.0–1.0 scale)

Score each trait based on evidence. Use 0.0 for absent/irrelevant,
0.3–0.4 for moderate, 0.6–0.7 for present/notable, 1.0 for defining.

Required traits:
- flow: musical continuity and rhythmic naturalness
- tonal_density: harmonic weight and body
- clarity: transparency and inner detail
- dynamics: dynamic range expression and punch
- fatigue_risk: likelihood of listening fatigue (0.0 = no risk, 1.0 = high risk)
- glare_risk: treble harshness or sibilance risk (0.0 = no risk, 1.0 = high risk)
- texture: grain, surface quality, tactile quality of sound
- composure: ability to stay controlled under complex or loud passages
- warmth: tonal warmth and midrange body
- speed: transient speed and attack articulation
- spatial_precision: imaging accuracy and soundstage definition
- elasticity: dynamic expressiveness and rhythmic responsiveness
`;

// ── Tendency level definitions ───────────────────────

const TENDENCY_DEFINITIONS = `
## TendencyProfile Levels

For each trait, assign one of:
- "emphasized": a defining characteristic — this is what the product is known for
- "present": clearly there, but not a standout feature
- "less_emphasized": structurally or intentionally de-prioritized

Only include traits where evidence supports a clear directional claim.
Traits not listed are treated as neutral by default.

Risk flags (include only if supported by evidence):
- "fatigue_risk": product has elevated fatigue potential
- "glare_risk": product has treble harshness or sibilance risk
`;

// ── Output schema ────────────────────────────────────

const OUTPUT_SCHEMA = `
## Output Schema

Return a single JSON object matching this exact structure.
All fields marked "required" must be present. Optional fields
should be included when evidence supports them.

{
  "id": "brand-model-name",                    // required: kebab-case slug
  "brand": "Brand Name",                        // required
  "name": "Model Name",                         // required
  "category": "amplifier|dac|speaker|...",      // required: ProductCategory
  "price": 2500,                                // optional: approximate USD price
  "priceCurrency": "USD",                       // optional: ISO 4217
  "architecture": "Class A/AB solid-state...",  // optional: topology description
  "priceTier": "budget|lower-mid|mid-fi|upper-mid|high-end|ultra", // optional
  "brandScale": "mainstream|specialist|boutique", // optional
  "region": "north-america|europe|east-asia|south-asia|oceania|other", // optional
  "country": "US",                              // optional: ISO 3166-1 alpha-2

  "primaryAxes": {                              // required
    "warm_bright": "warm|bright|neutral",
    "smooth_detailed": "smooth|detailed|neutral",
    "elastic_controlled": "elastic|controlled|neutral",
    "airy_closed": "airy|closed|neutral"
  },

  "traits": {                                   // required
    "flow": 0.7,
    "tonal_density": 0.7,
    "clarity": 0.7,
    "dynamics": 1.0,
    "fatigue_risk": 0.0,
    "glare_risk": 0.0,
    "texture": 0.7,
    "composure": 1.0,
    "warmth": 0.4,
    "speed": 0.7,
    "spatial_precision": 0.7,
    "elasticity": 0.7
  },

  "tendencyProfile": {                          // required
    "basis": "review_consensus",
    "confidence": "high|medium|low",
    "tendencies": [
      { "trait": "dynamics", "level": "emphasized|present|less_emphasized" }
    ],
    "riskFlags": []                             // "fatigue_risk" | "glare_risk"
  },

  "fatigueAssessment": {                        // required
    "risk": "low|moderate|elevated",
    "notes": "Brief explanation of fatigue characteristics."
  },

  "tendencies": {                               // required
    "confidence": "medium",
    "character": [                              // 3-5 entries covering different domains
      {
        "domain": "dynamics|tonality|spatial|timing|texture",
        "tendency": "Plain-language description of what this product tends to do.",
        "basis": "review_consensus|listener_consensus|manufacturer_intent|editorial_inference"
      }
    ],
    "interactions": [                           // 2-3 entries
      {
        "condition": "paired with [type of component]",
        "effect": "what tends to happen",
        "valence": "positive|neutral|caution",
        "basis": "review_consensus|listener_consensus"
      }
    ],
    "tradeoffs": [                              // 1-2 entries
      {
        "gains": "what this product delivers",
        "cost": "what it typically sacrifices",
        "relative_to": "reference frame (competitors, price class)",
        "basis": "review_consensus|listener_consensus"
      }
    ]
  },

  "description": "2-3 sentence synthesis...",   // required: paraphrased, never copied

  "sourceReferences": [                         // required: attribution
    { "source": "Publication name", "note": "Brief note on what the source contributed." }
  ]
}
`;

// ── Guardrails ───────────────────────────────────────

const GUARDRAILS = `
## Guardrails — You MUST follow these rules

1. NEVER copy text verbatim from the evidence observations. Synthesize and paraphrase.
2. NEVER invent observations not supported by the evidence. If a domain has no evidence, mark the axis as "neutral" and omit traits/tendencies for that domain.
3. When sources disagree, position the axis where the majority of evidence points. Note the disagreement in the rationale (not in the output).
4. Fatigue and glare risk should default to 0.0 unless evidence explicitly mentions fatigue, harshness, sibilance, or listening strain.
5. Do not use superlatives ("best", "greatest", "unmatched"). Use directional language ("tends toward", "leans toward", "known for").
6. Basis fields must accurately reflect where the claim comes from:
   - "review_consensus" for patterns across professional reviews
   - "listener_consensus" for recurring patterns in community discussion
   - "manufacturer_intent" for stated design goals
   - "editorial_inference" for claims inferred from design approach or measurements
7. Price should be approximate street/used price in USD. If unknown, omit.
8. The description must be original synthesis — not a copy or close paraphrase of any single source.
9. Return ONLY the JSON object. No markdown fencing, no commentary, no explanation.
`;

// ── Prompt builder ───────────────────────────────────

/**
 * Build a reviewer calibration section if any evidence sources come
 * from publications with known reviewer profiles.
 *
 * Returns an empty string if no reviewer profiles match.
 */
function buildReviewerCalibration(evidence: EvidenceRecord): string {
  // Collect unique publication names from evidence sources
  const publications = new Set<string>();
  for (const source of evidence.sources) {
    if (source.publication) publications.add(source.publication);
  }

  // Find reviewer IDs for these publications
  const reviewerIds = new Set<string>();
  for (const pub of publications) {
    const reviewers = findReviewersByPublication(pub);
    for (const r of reviewers) reviewerIds.add(r.id);
  }

  if (reviewerIds.size === 0) return '';

  const note = buildReviewerCalibrationNote([...reviewerIds]);
  return note ? `${note}\n\n` : '';
}

/**
 * Format evidence sources into a readable block for the LLM.
 */
function formatEvidenceSources(sources: EvidenceSource[]): string {
  return sources
    .map((s, i) => {
      const reliability = s.reliability === 'high' ? '(HIGH reliability)' :
                          s.reliability === 'medium' ? '(MEDIUM reliability)' :
                          '(LOW reliability)';
      const observations = s.observations
        .map((o: SonicObservation) => `    - [${o.domain}] ${o.summary}`)
        .join('\n');

      return `### Source ${i + 1}: ${s.title} ${reliability}
  Kind: ${s.kind}
  Publication: ${s.publication ?? 'Unknown'}
  Date: ${s.date ?? 'Unknown'}

  Observations:
${observations}`;
    })
    .join('\n\n');
}

/**
 * Build the complete synthesis prompt for an EvidenceRecord.
 *
 * Returns a string ready to be sent to the LLM as a user message.
 * The system message should instruct the LLM to act as an audio
 * equipment analyst producing structured product data.
 *
 * @param evidence — A sufficient EvidenceRecord (status === 'sufficient')
 * @returns The complete prompt string
 */
export function buildSynthesisPrompt(evidence: EvidenceRecord): string {
  if (evidence.status !== 'sufficient') {
    throw new Error(
      `Cannot synthesize from insufficient evidence: ${evidence.productId} (status: ${evidence.status})`
    );
  }

  const domainsCovered = new Set(
    evidence.sources.flatMap((s) => s.observations.map((o) => o.domain))
  );

  return `# Product Synthesis Task

You are synthesizing a structured product record for the Audio XX advisory engine.

## Product Information

- **Product:** ${evidence.brand} ${evidence.productName}
- **Product ID:** ${evidence.productId}
- **Brand:** ${evidence.brand}
- **Category:** ${evidence.category}
${evidence.architecture ? `- **Architecture:** ${evidence.architecture}` : ''}
${evidence.price ? `- **Approximate price:** $${evidence.price}` : ''}
- **Evidence sources:** ${evidence.sources.length}
- **Agreement level:** ${evidence.agreementLevel}
- **Domains covered:** ${[...domainsCovered].join(', ')}

## Evidence

${formatEvidenceSources(evidence.sources)}

${AXIS_ANCHORS}

${TRAIT_DEFINITIONS}

${TENDENCY_DEFINITIONS}

${OUTPUT_SCHEMA}

${GUARDRAILS}

${buildReviewerCalibration(evidence)}
Now synthesize a complete product record from the evidence above.
Use the product ID "${evidence.productId}" in your output.
Return ONLY the JSON object.`;
}

/**
 * Build the system message for the synthesis LLM call.
 *
 * Kept separate so callers can configure the model and parameters
 * independently of the prompt content.
 */
export function buildSynthesisSystemMessage(): string {
  return `You are a sonic analyst for Audio XX, an audio advisory platform. Your task is to synthesize structured product records from curated review evidence.

You produce precise, calibrated assessments of audio equipment sonic characteristics. Your output is a JSON object that will be programmatically consumed — it must be valid JSON with no additional text.

Core principles:
- Accuracy over completeness. Omit fields rather than guess.
- Neutrality. No brand bias, no hype, no deprecation.
- Evidence-grounded. Every claim must trace to the provided evidence.
- Calibrated. Position products relative to the provided axis anchors.
- Paraphrased. Never copy source text verbatim.`;
}

/**
 * Validate that a synthesis output has the required fields.
 *
 * This is a structural check only — it does not validate semantic
 * correctness. Returns an array of error messages (empty if valid).
 */
export function validateSynthesisOutput(output: unknown): string[] {
  const errors: string[] = [];

  if (!output || typeof output !== 'object') {
    return ['Output is not an object'];
  }

  const o = output as Record<string, unknown>;

  // Required string fields
  for (const field of ['id', 'brand', 'name', 'category', 'description']) {
    if (typeof o[field] !== 'string' || (o[field] as string).length === 0) {
      errors.push(`Missing or empty required field: ${field}`);
    }
  }

  // primaryAxes
  if (!o.primaryAxes || typeof o.primaryAxes !== 'object') {
    errors.push('Missing primaryAxes');
  } else {
    const axes = o.primaryAxes as Record<string, unknown>;
    for (const axis of ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed']) {
      const val = axes[axis];
      if (typeof val !== 'string') {
        errors.push(`Missing primaryAxes.${axis}`);
      }
    }
  }

  // traits
  if (!o.traits || typeof o.traits !== 'object') {
    errors.push('Missing traits');
  } else {
    const traits = o.traits as Record<string, unknown>;
    const required = ['flow', 'tonal_density', 'clarity', 'dynamics', 'fatigue_risk', 'glare_risk', 'texture', 'composure', 'warmth', 'speed', 'spatial_precision', 'elasticity'];
    for (const t of required) {
      if (typeof traits[t] !== 'number') {
        errors.push(`Missing or non-numeric trait: ${t}`);
      }
    }
  }

  // tendencyProfile
  if (!o.tendencyProfile || typeof o.tendencyProfile !== 'object') {
    errors.push('Missing tendencyProfile');
  }

  // fatigueAssessment
  if (!o.fatigueAssessment || typeof o.fatigueAssessment !== 'object') {
    errors.push('Missing fatigueAssessment');
  }

  // tendencies
  if (!o.tendencies || typeof o.tendencies !== 'object') {
    errors.push('Missing tendencies');
  } else {
    const t = o.tendencies as Record<string, unknown>;
    if (!Array.isArray(t.character) || t.character.length === 0) {
      errors.push('Missing or empty tendencies.character');
    }
    if (!Array.isArray(t.interactions) || t.interactions.length === 0) {
      errors.push('Missing or empty tendencies.interactions');
    }
    if (!Array.isArray(t.tradeoffs) || t.tradeoffs.length === 0) {
      errors.push('Missing or empty tendencies.tradeoffs');
    }
  }

  // sourceReferences
  if (!Array.isArray(o.sourceReferences) || o.sourceReferences.length === 0) {
    errors.push('Missing or empty sourceReferences');
  }

  return errors;
}
