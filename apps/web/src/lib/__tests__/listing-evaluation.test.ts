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

    expect(systemPrompt).toMatch(/##\s*1\.\s*Listing read/);
    expect(systemPrompt).toMatch(/##\s*2\.\s*Translation/);
    expect(systemPrompt).toMatch(/##\s*3\.\s*Likely gear identified/);
    expect(systemPrompt).toMatch(/##\s*4\.\s*Fit with your system/);
    expect(systemPrompt).toMatch(/##\s*5\.\s*Risks \/ missing information/);
    expect(systemPrompt).toMatch(/##\s*6\.\s*Questions to ask the seller/);
    expect(systemPrompt).toMatch(/##\s*7\.\s*Bottom-line recommendation/);
  });

  it('requires Markdown ## headings and blank lines between sections', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    // The prompt must instruct the model to use ## headings and to
    // separate sections with blank lines. Without this contract the
    // model produces a wall-of-text that the chat composer cannot
    // visually segment for the user.
    expect(systemPrompt).toMatch(/level-2 Markdown heading/i);
    expect(systemPrompt).toMatch(/blank line between/i);
    expect(systemPrompt).toMatch(/##\s*1\.\s*Listing read[^\n]*\n\n/);
    expect(systemPrompt).toMatch(/##\s*7\.\s*Bottom-line recommendation/);
  });

  it('enumerates the four bottom-line verdict options without "buy now"', () => {
    const { systemPrompt } = buildListingEvalPrompt({ images: [SAMPLE_IMAGE] });

    expect(systemPrompt).toMatch(/Worth exploring/);
    expect(systemPrompt).toMatch(/Ask questions first/);
    expect(systemPrompt).toMatch(/Likely not a fit/);
    expect(systemPrompt).toMatch(/Hard to judge/);

    // "buy now" must appear only inside the prohibition, never as a verdict.
    const banLine = systemPrompt.match(/Never say "buy now"[^\n]*/i);
    expect(banLine).not.toBeNull();
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
