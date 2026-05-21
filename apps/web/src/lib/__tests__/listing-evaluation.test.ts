/**
 * Listing-evaluation prompt builder — MVP unit tests.
 *
 * Locks the contract that the /api/listing-eval route depends on:
 *   1. The system prompt enumerates all seven required sections.
 *   2. The system prompt includes the hard safety boundaries.
 *   3. Every image is forwarded as an image_url part on the user message.
 *   4. Saved-system context is folded into the user text when present.
 *   5. Without a saved system, the prompt invites a generic read.
 *   6. User text is forwarded when provided.
 */

import { describe, it, expect } from 'vitest';
import { buildListingEvalPrompt } from '../listing-evaluation';

const SAMPLE_IMAGE = 'data:image/jpeg;base64,/9j/AA==';

describe('buildListingEvalPrompt', () => {
  it('lists all seven required sections in the system prompt', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    // Headings are now bare phrases (no numeric prefix) so the model
    // has fewer moving parts to get wrong. The renderer self-heals if
    // the model emits numbered variants — but the contract the prompt
    // asks for is the clean form.
    expect(systemPrompt).toMatch(/##\s+Listing read\b/);
    expect(systemPrompt).toMatch(/##\s+Translation\b/);
    expect(systemPrompt).toMatch(/##\s+Likely gear identified\b/);
    expect(systemPrompt).toMatch(/##\s+Fit with your system\b/);
    expect(systemPrompt).toMatch(/##\s+Risks \/ missing information\b/);
    expect(systemPrompt).toMatch(/##\s+Questions to ask the seller\b/);
    expect(systemPrompt).toMatch(/##\s+Bottom-line recommendation\b/);
  });

  it('requires Markdown ## headings and blank lines between sections', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    // The prompt must instruct the model — emphatically — to use ##
    // headings and to separate sections with blank lines. Without this
    // contract the model produces a wall-of-text that the chat composer
    // cannot visually segment for the user. The wording is deliberately
    // strong ("non-negotiable", "ONE BLANK LINE") because vision turns
    // appear to be more formatting-loose than text-only turns.
    expect(systemPrompt).toMatch(/non-negotiable/i);
    expect(systemPrompt).toMatch(/level-2 Markdown heading/i);
    expect(systemPrompt).toMatch(/ONE BLANK LINE/);
    expect(systemPrompt).toMatch(/##\s+Listing read[^\n]*\n\n/);
    expect(systemPrompt).toMatch(/##\s+Bottom-line recommendation/);
  });

  it('includes a worked example of the exact output shape', () => {
    // A literal example is the most reliable nudge for vision turns —
    // the model anchors on the shape of the example rather than parsing
    // a list of bullets about formatting.
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });
    expect(systemPrompt).toMatch(/Worked example/i);
    expect(systemPrompt).toMatch(/EXACT output shape/);
    expect(systemPrompt).toMatch(/Example Brand/);
  });

  it('enumerates the six bottom-line verdict labels without "buy now"', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    // Verdict list expanded from 4 to 6 labels to give the model a way
    // to express candid system-fit judgment beyond the old positive /
    // ask-questions / not-a-fit / hard-to-judge axis. The cheap-vintage
    // case ("interesting but not your system" or "secondary / experiment
    // only") needs its own labels — otherwise the model defaults to
    // the closest-to-positive verdict.
    expect(systemPrompt).toMatch(/\*\*Strong candidate for your system\*\*/);
    expect(systemPrompt).toMatch(/\*\*Worth exploring with questions\*\*/);
    expect(systemPrompt).toMatch(/\*\*Interesting but not a clear system fit\*\*/);
    expect(systemPrompt).toMatch(/\*\*Secondary-system \/ experiment only\*\*/);
    expect(systemPrompt).toMatch(/\*\*Not recommended for your system\*\*/);
    expect(systemPrompt).toMatch(/\*\*Hard to judge from the listing alone\*\*/);

    // "buy now" must appear only inside the prohibition, never as a verdict.
    const banLine = systemPrompt.match(/Never say "buy now"[^\n]*/i);
    expect(banLine).not.toBeNull();
  });

  it('requires candid advisory judgment, not default-positive fit language', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    // The advisory-judgment block must be present and emphatic. Anchor
    // phrases the test locks: "Be candid", "Do not default to positive
    // fit language", and the cheap-vs-fit distinction. These wordings
    // are what stops the regression observed on the Sony TA-E45 case
    // where a cheap vintage piece was called a "good fit" for a
    // higher-tier saved chain.
    expect(systemPrompt).toMatch(/Be candid/);
    expect(systemPrompt).toMatch(/Do not default to positive fit language/i);
    expect(systemPrompt).toMatch(
      /not (a "?good fit"?|merely a "?good fit"?|"?good fit"?)?\s*merely because (it|the gear) is technically compatible/i,
    );
    expect(systemPrompt).toMatch(
      /good value as a cheap used item.*good match for this system/i,
    );
    expect(systemPrompt).toMatch(/low price does not make something a good recommendation/i);
  });

  it('requires explicit comparison against saved-system context', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    // "Fit with your system" must drive the model through the candor
    // checklist (tier match, role duplication, sonic direction, net
    // effect, age/service risk, price-vs-purpose) — not a one-liner
    // about character.
    expect(systemPrompt).toMatch(/Tier match/);
    expect(systemPrompt).toMatch(/Role duplication/);
    expect(systemPrompt).toMatch(/Sonic direction/);
    expect(systemPrompt).toMatch(/Net effect/);
    expect(systemPrompt).toMatch(/improve the chain, weaken it, or merely change/i);
  });

  it('includes example phrasings that model candid judgments', () => {
    // Concrete example phrases anchor the model on the candor tone we
    // want — abstract directives ("be candid") are weaker than showing
    // a phrase that exemplifies the stance.
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });
    expect(systemPrompt).toMatch(/cheap experiment.*not.*upgrade for your main system/i);
    expect(systemPrompt).toMatch(/secondary vintage setup/i);
    expect(systemPrompt).toMatch(/not directionally aligned with the saved system/i);
  });

  it('includes the hard safety boundaries in the system prompt', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    expect(systemPrompt).toMatch(/visible listing/i);
    expect(systemPrompt).toMatch(/do not verify authenticity/i);
    expect(systemPrompt).toMatch(/do not claim a definitive market value/i);
    expect(systemPrompt).toMatch(/never say "buy now"/i);
    expect(systemPrompt).toMatch(/appears to be/i);
  });

  it('forwards one image_url part per provided image', () => {
    const imgA = 'data:image/jpeg;base64,AAAA';
    const imgB = 'data:image/png;base64,BBBB';
    const imgC = 'data:image/webp;base64,CCCC';

    const { userContent } = buildListingEvalPrompt({
      images: [imgA, imgB, imgC],
    });

    const imageParts = userContent.filter((p) => p.type === 'image_url');
    expect(imageParts).toHaveLength(3);
    expect(imageParts.map((p) => (p.type === 'image_url' ? p.image_url.url : null))).toEqual([
      imgA,
      imgB,
      imgC,
    ]);
  });

  it('includes saved-system context in the user text when provided', () => {
    const { userContent } = buildListingEvalPrompt({
      images: [SAMPLE_IMAGE],
      savedSystem: {
        components: ['DeVore O/96', 'Leben CS600X', 'Rega Planar 6'],
        character: 'warm, elastic, slightly relaxed top',
      },
    });

    const textPart = userContent.find((p) => p.type === 'text');
    expect(textPart).toBeDefined();
    if (textPart && textPart.type === 'text') {
      expect(textPart.text).toContain('DeVore O/96');
      expect(textPart.text).toContain('Leben CS600X');
      expect(textPart.text).toContain('Rega Planar 6');
      expect(textPart.text).toMatch(/warm, elastic/);
    }
  });

  it('invites a generic read when no saved system is provided', () => {
    const { userContent } = buildListingEvalPrompt({
      images: [SAMPLE_IMAGE],
    });

    const textPart = userContent.find((p) => p.type === 'text');
    expect(textPart).toBeDefined();
    if (textPart && textPart.type === 'text') {
      expect(textPart.text).toMatch(/no saved system/i);
      expect(textPart.text).toMatch(/invite the user to share/i);
    }
  });

  it('forwards user note text when provided', () => {
    const { userContent } = buildListingEvalPrompt({
      images: [SAMPLE_IMAGE],
      userText: 'Found this on a local board — is it worth a closer look?',
    });

    const textPart = userContent.find((p) => p.type === 'text');
    expect(textPart).toBeDefined();
    if (textPart && textPart.type === 'text') {
      expect(textPart.text).toContain('Found this on a local board');
    }
  });

  it('places image_url parts after the text part', () => {
    const { userContent } = buildListingEvalPrompt({
      images: [SAMPLE_IMAGE, SAMPLE_IMAGE],
      userText: 'check this',
    });

    expect(userContent[0]?.type).toBe('text');
    expect(userContent[1]?.type).toBe('image_url');
    expect(userContent[2]?.type).toBe('image_url');
  });
});
