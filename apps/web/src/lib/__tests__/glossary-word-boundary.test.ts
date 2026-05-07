/**
 * Glossary partial-match word-boundary regression test.
 *
 * Locks the fix for the "pairing" → "air" misclassification: the partial
 * fallback inside `findEntry` previously used `String.includes`, which
 * collided on words that contain a glossary term as a substring (e.g.
 * "p[air]ing"). The fix uses word-boundary regex matching so the term
 * must appear as a whole word.
 *
 * Scope: pure unit test on `checkGlossaryQuestion`. No renderer, no
 * page-level integration.
 */

import { describe, it, expect } from 'vitest';
import { checkGlossaryQuestion } from '../glossary';

describe('checkGlossaryQuestion — word-boundary partial matching', () => {
  it('matches the glossary term when asked directly', () => {
    const result = checkGlossaryQuestion('what is air?');
    expect(result).not.toBeNull();
    expect(result!.term).toBe('air');
  });

  it('matches the glossary term when used as a whole word inside the query', () => {
    // Compound prose containing "air" as a standalone word should still
    // resolve via the partial fallback.
    const result = checkGlossaryQuestion('what does air mean in audio?');
    expect(result).not.toBeNull();
    expect(result!.term).toBe('air');
  });

  it('does NOT match a glossary term that appears only as a substring inside a different word', () => {
    // "pairing" contains "air" but is a different word — must not collide.
    const result = checkGlossaryQuestion('What are you pairing it with?');
    expect(result).toBeNull();
  });

  it('does NOT match when a glossary term appears only inside another word in a definitional phrasing', () => {
    // "What is pairing?" — captures "pairing"; "pairing".includes("air") used
    // to return the air entry. With word-boundary matching, no entry should
    // match unless the glossary actually has "pairing" as a term/alias.
    const result = checkGlossaryQuestion('What is pairing?');
    if (result) {
      // If the glossary one day adds "pairing" as a real term, that's a
      // legitimate match. Otherwise: no match.
      expect(result.term).not.toBe('air');
    }
  });

  it('still resolves aliases as whole words', () => {
    // "airy" and "airiness" are aliases of the air entry. As long as they
    // appear as whole words, partial fallback resolves them.
    const result = checkGlossaryQuestion('what does airy mean?');
    expect(result).not.toBeNull();
    expect(result!.term).toBe('air');
  });
});
