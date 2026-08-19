import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../product/assessment-pipeline';
import {
  assessedEveryComponent, readComponentNames,
} from '../artifact/synthesizeArtifact';
import { toEvidenceItem, factCandidateNames } from '../evidence/manufacturer-facts';
import type { EvidenceItem } from '../evidence/evidence-types';

/**
 * The artifact is the assessment the listener saves, prints and shares.
 *
 * Three defects found on the same system on 2026-08-19, all of the same shape:
 * an absence read as a finding.
 *
 * 1. The artifact pipeline never received manufacturer evidence, so the web
 *    assessment could name a power constraint while the artifact of the
 *    identical system said nothing. One canonical assessment cannot mean two
 *    answers depending on which surface asked.
 *
 * 2. `assessedEveryComponent` tested for the PRESENCE of axis keys. An
 *    unresolved component is handed synthetic neutral axes so downstream
 *    shapes stay uniform, and those placeholders counted as a reading — so a
 *    2 W amplifier into an unidentified loudspeaker returned "Nothing here
 *    needs changing."
 *
 * 3. The recommendation license modelled two states where there are three.
 *    "No bottleneck" splits into one the engine earned by reading everything
 *    and one it merely failed to reach.
 */

const fact = (product: string, field: string, value: string, host: string): EvidenceItem =>
  toEvidenceItem(product, {
    field: field as never, value,
    sourceUrl: `https://${host}/products/x`, quotedText: value,
  }, Date.now());

// Decware SE84UFO is catalogued at 2 W; the Acora QRC-2 is not catalogued, so
// its sensitivity exists only as a manufacturer-published fact.
const CONSTRAINED = 'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 '
  + 'Dac: Denafrips Pontus II';
const ACORA_SENSITIVITY = [fact('Acora QRC-2', 'sensitivity', '84 dB', 'acoraaudio.com')];

// Every component catalogued and coherent — the control that must not move.
const COHERENT = 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus';

describe('1. manufacturer evidence reaches the artifact', () => {
  it('the pipeline accepts and consumes it', () => {
    const p = runArtifactPipeline(CONSTRAINED, ACORA_SENSITIVITY)!.payload as never as
      { verdict: string; heroDatum?: { value: string }; caseParagraphs: string[] };
    expect(p.verdict).toMatch(/can'?t drive|need more power/i);
    expect(p.heroDatum?.value).toMatch(/87 dB/);
    expect(p.caseParagraphs.join(' ')).toMatch(/84 dB sensitivity/);
  });

  it('the canonical model carries it too, so print and share cannot diverge', () => {
    const c = runArtifactPipeline(CONSTRAINED, ACORA_SENSITIVITY)!.canonical;
    expect(JSON.stringify(c)).toMatch(/87 dB/);
  });

  it('names are selected by one shared definition', () => {
    // The web path and the artifact path must ask for facts about the same
    // products; two selectors is how the surfaces drifted apart.
    expect(factCandidateNames([
      { name: 'Acora QRC-2', kind: 'product' },
      { name: 'Goldmund', kind: 'brand' },
      { name: 'Job', kind: 'product', parenthetical: true },
      { name: 'acora qrc-2', kind: 'product' },
    ])).toEqual(['Acora QRC-2']);
  });
});

describe('2. an unread component is not a reading', () => {
  it('synthetic neutral axes do not count as read', () => {
    const read = readComponentNames([
      { name: 'Decware SE84UFO', axes: { warm_bright: 'warm' }, source: 'product' },
      { name: 'Acora QRC-2', axes: { warm_bright: 'neutral' }, source: 'inferred' },
    ]);
    expect(read.has('decware se84ufo')).toBe(true);
    expect(read.has('acora qrc-2')).toBe(false);
    expect(assessedEveryComponent(['Decware SE84UFO', 'Acora QRC-2'], [
      { name: 'Decware SE84UFO', axes: { warm_bright: 'warm' }, source: 'product' },
      { name: 'Acora QRC-2', axes: { warm_bright: 'neutral' }, source: 'inferred' },
    ])).toBe(false);
  });

  it('a reading with no source field is unchanged (callers predating it)', () => {
    expect(assessedEveryComponent(['A'], [{ name: 'A', axes: { warm_bright: 'warm' } }])).toBe(true);
  });

  it('withholds the all-clear on the under-read system', () => {
    const p = runArtifactPipeline(CONSTRAINED)!.payload as never as { verdict: string };
    expect(p.verdict).not.toMatch(/Nothing here needs changing/i);
    expect(p.verdict).toMatch(/can'?t reach a verdict/i);
  });

  it('makes no relational claim about the component it could not read', () => {
    const p = runArtifactPipeline(CONSTRAINED)!.payload as never as { caseParagraphs: string[] };
    const prose = p.caseParagraphs.join(' ');
    expect(prose).not.toMatch(/Acora QRC-2 carries it/i);
    expect(prose).not.toMatch(/without thinning it out/i);
  });
});

describe('3. the recommendation follows the same licensed state as the verdict', () => {
  it('does not close with restraint when no verdict was reachable', () => {
    const p = runArtifactPipeline(CONSTRAINED)!.payload as never as
      { recommendation: string; cost: string };
    expect(p.recommendation).not.toMatch(/nothing here to fix|already well balanced/i);
    expect(p.recommendation).toMatch(/can'?t recommend a change/i);
    // It must say WHICH component it could not read — otherwise the listener
    // has no way to act on the gap.
    expect(p.recommendation).toMatch(/Acora QRC-2/);
    expect(p.cost).not.toMatch(/name the quality/i);
  });

  it('acts on the constraint once the evidence arrives', () => {
    const p = runArtifactPipeline(CONSTRAINED, ACORA_SENSITIVITY)!.payload as never as
      { recommendation: string };
    expect(p.recommendation).toMatch(/power mismatch|more amplifier power/i);
  });
});

describe('the coherent control is not penalised by any of this', () => {
  const bare = runArtifactPipeline(COHERENT)!.payload as never as
    { verdict: string; recommendation: string; caseParagraphs: string[] };

  it('keeps its earned restraint', () => {
    expect(bare.verdict).toBe('Nothing here needs changing.');
    expect(bare.recommendation).toMatch(/nothing here to fix|already well balanced/i);
  });

  it('keeps the equilibrium prose that names its components', () => {
    expect(bare.caseParagraphs.length).toBeGreaterThan(0);
  });

  it('reads identically with unrelated evidence in scope', () => {
    const withEv = runArtifactPipeline(COHERENT, ACORA_SENSITIVITY)!.payload;
    expect(JSON.stringify(withEv)).toBe(JSON.stringify(bare));
  });
});
