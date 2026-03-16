/**
 * Evidence Store — Curated review evidence for products not yet in
 * the validated Audio XX catalog.
 *
 * This file holds EvidenceRecord entries. Each record accumulates
 * paraphrased observations from approved review sources. Once a
 * record reaches 'sufficient' status, it can be fed to the synthesis
 * pipeline to produce a ProvisionalProduct.
 *
 * ── How to add evidence ──────────────────────────────────────────
 *
 * 1. Create or find the EvidenceRecord for the product.
 * 2. Add an EvidenceSource with paraphrased observations.
 *    - NEVER copy review text verbatim.
 *    - Tag each observation with the correct domain.
 * 3. Update agreementLevel based on cross-source consistency.
 * 4. Set status to 'sufficient' when:
 *    - At least 3 of 4 axes are covered by observations
 *    - At least 2 independent sources are present
 *    - No unresolvable contradictions in core axis positions
 *
 * Products in this store are NOT yet usable by the advisory engine.
 * They become usable only after synthesis into a ProvisionalProduct.
 */

import type { EvidenceRecord } from './types';

// ── Evidence records ─────────────────────────────────
//
// Add new records below as editorial ingestion progresses.
// Each record follows the EvidenceRecord schema defined in types.ts.

export const EVIDENCE_STORE: EvidenceRecord[] = [
  // ── Kinki Studio EX-M1 ───────────────────────────────
  // A commonly asked-about Chinese Class A integrated amplifier.
  // Not in the validated catalog — good candidate for review synthesis.
  {
    productId: 'kinki-studio-ex-m1',
    productName: 'EX-M1',
    brand: 'Kinki Studio',
    category: 'amplifier',
    architecture: 'Class A/AB solid-state integrated amplifier',
    price: 2500,
    sources: [
      {
        id: 'kinki-ex-m1-6moons',
        kind: 'professional_review',
        title: '6moons review — Kinki Studio EX-M1',
        url: 'https://www.6moons.com/',
        publication: '6moons',
        date: '2019-06',
        observations: [
          { domain: 'dynamics', summary: 'Authoritative dynamic grip with high current delivery. Controls demanding speakers well beyond what the price suggests.' },
          { domain: 'tonality', summary: 'Neutral to slightly warm tonality. Not lush, but not lean either — sits in a balanced middle ground.' },
          { domain: 'timing', summary: 'Fast, composed transient response. Good rhythmic articulation without sounding mechanical.' },
        ],
        reliability: 'high',
        addedAt: '2026-03-16',
      },
      {
        id: 'kinki-ex-m1-audiosciencereview',
        kind: 'forum_consensus',
        title: 'ASR community listening impressions',
        publication: 'Audio Science Review',
        observations: [
          { domain: 'dynamics', summary: 'High power output with excellent current delivery. Drives low-impedance loads without strain.' },
          { domain: 'spatial', summary: 'Wide, well-separated soundstage. Good depth layering for the price class.' },
          { domain: 'tonality', summary: 'Clean and neutral. Some listeners note very slight warmth in the midrange but overall even-handed.' },
        ],
        reliability: 'medium',
        addedAt: '2026-03-16',
      },
      {
        id: 'kinki-ex-m1-headfi',
        kind: 'forum_consensus',
        title: 'Head-Fi integrated amplifier comparison thread',
        publication: 'Head-Fi',
        observations: [
          { domain: 'texture', summary: 'Smooth grain structure — not etched or analytical. Good midrange texture for the price.' },
          { domain: 'fatigue', summary: 'Low fatigue — the lack of glare and controlled treble make it easy to listen to for long sessions.' },
          { domain: 'general', summary: 'Frequently compared to amplifiers costing 2-3x more. Build quality and power delivery seen as exceptional value.' },
        ],
        reliability: 'medium',
        addedAt: '2026-03-16',
      },
    ],
    agreementLevel: 'strong',
    status: 'sufficient',
    createdAt: '2026-03-16',
    updatedAt: '2026-03-16',
  },
];

// ── Lookup helpers ───────────────────────────────────

/**
 * Find an evidence record by product ID.
 */
export function findEvidence(productId: string): EvidenceRecord | undefined {
  return EVIDENCE_STORE.find((r) => r.productId === productId);
}

/**
 * Find evidence records matching a product name (case-insensitive).
 * Checks both productName and brand+productName.
 */
export function findEvidenceByName(name: string): EvidenceRecord | undefined {
  const lower = name.toLowerCase().trim();
  return EVIDENCE_STORE.find((r) => {
    const full = `${r.brand} ${r.productName}`.toLowerCase();
    return (
      r.productName.toLowerCase() === lower ||
      full === lower ||
      r.productId === lower
    );
  });
}

/**
 * Get all evidence records ready for synthesis.
 */
export function getSufficientEvidence(): EvidenceRecord[] {
  return EVIDENCE_STORE.filter((r) => r.status === 'sufficient');
}
