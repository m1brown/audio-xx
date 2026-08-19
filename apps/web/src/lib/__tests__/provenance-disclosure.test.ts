import { describe, it, expect } from 'vitest';
import { describeProvenance } from '../provenance-disclosure';

/**
 * The badge said EXPANDED REASONING and stopped there — a trust signal that
 * asks for suspicion and supplies no basis for it. These pin what the
 * disclosure behind it must say, and what it must never claim.
 */

const expanded = (componentProvenance?: Array<{ name: string; basis: never }>) =>
  describeProvenance({
    reasoningMode: 'expanded',
    fallbackReason: 'low_confidence_system',
    componentProvenance,
  });

describe('the disclosure appears exactly when the badge does', () => {
  it('is silent on core reasoning', () => {
    expect(describeProvenance({ reasoningMode: 'core' }).show).toBe(false);
  });

  it('appears on expanded reasoning even with no fallback reason recorded', () => {
    // The bare-badge case: expanded, no reason, previously no explanation.
    const p = describeProvenance({ reasoningMode: 'expanded' });
    expect(p.show).toBe(true);
    expect(p.paragraphs.length).toBeGreaterThan(0);
    expect(p.caption).toMatch(/expanded reasoning/i);
  });
});

describe('it explains the epistemic condition, not the mechanism', () => {
  const p = expanded([{ name: 'Acora QRC-2', basis: 'model' as never }]);

  it('says the product sits outside the catalogue and identity was verified', () => {
    const t = p.paragraphs.join(' ');
    expect(t).toMatch(/sits outside Audio XX’s curated catalogue/);
    expect(t).toMatch(/verified its identity/);
    expect(t).toMatch(/lower confidence/);
  });

  it('never reduces the explanation to "AI was used"', () => {
    const t = p.paragraphs.join(' ').toLowerCase();
    expect(t).not.toMatch(/\bai\b/);
    expect(t).not.toMatch(/language model|chatgpt|gpt/);
  });
});

describe('brand evidence is not model evidence', () => {
  const p = expanded([{ name: 'Shindo Laboratory', basis: 'brand' as never }]);

  it('states the distinction explicitly', () => {
    const t = p.paragraphs.join(' ');
    expect(t).toMatch(/evidence about the maker/i);
    expect(t).toMatch(/does not by itself establish a characteristic of one product/i);
  });
});

describe('a component we could not identify is described as such', () => {
  const p = expanded([{ name: 'Zorblax ZX1', basis: 'user' as never }]);

  it('says it stands on the listener’s description alone', () => {
    const t = p.paragraphs.join(' ');
    expect(t).toMatch(/on your description alone/);
    expect(t).toMatch(/no characteristic is claimed/);
  });
});

describe('mixed provenance names every basis present', () => {
  const p = expanded([
    { name: 'Chord Qutest', basis: 'catalog' as never },
    { name: 'Butler MONAD A100', basis: 'model' as never },
    { name: 'Acora', basis: 'brand' as never },
    { name: 'Zorblax ZX1', basis: 'user' as never },
  ]);

  it('produces one paragraph per basis, strongest first', () => {
    expect(p.paragraphs).toHaveLength(4);
    expect(p.paragraphs[0]).toMatch(/Chord Qutest/);
    expect(p.paragraphs[0]).toMatch(/curated catalogue/);
    expect(p.paragraphs[1]).toMatch(/Butler MONAD A100/);
    expect(p.paragraphs[2]).toMatch(/Acora/);
    expect(p.paragraphs[3]).toMatch(/Zorblax ZX1/);
  });

  it('groups several components of one basis into a single readable list', () => {
    const q = expanded([
      { name: 'A', basis: 'model' as never },
      { name: 'B', basis: 'model' as never },
      { name: 'C', basis: 'model' as never },
    ]);
    expect(q.paragraphs[0]).toMatch(/A, B and C sit outside/);
  });
});
