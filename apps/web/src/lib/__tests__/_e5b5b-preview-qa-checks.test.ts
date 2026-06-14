/**
 * Preview manual-QA equivalent tests for Brand House Voicing.
 *
 * Renders the seven fixtures listed in the E-5B.5B Preview-QA task
 * with NEXT_PUBLIC_BRAND_HOUSE_VOICING flag ON and asserts the
 * documented expectations. Also verifies flag-OFF byte-equivalence.
 *
 * Not part of the regression suite — TEMPORARY EVALUATION FILE.
 * No source changes. No commits.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import SystemAssessmentArtifact from '@/components/advisory/SystemAssessmentArtifact';

function render(advisory: AdvisoryResponse): string {
  return renderToStaticMarkup(
    createElement(SystemAssessmentArtifact, { advisory }),
  );
}

function decode(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

interface CardSlice {
  name: string;
  body: string;
}

function extractCardSlices(html: string): CardSlice[] {
  const idx = html.indexOf('The Components');
  if (idx === -1) return [];
  const slice = html.slice(idx);
  const re =
    /<div style="font-weight:600;font-size:0\.94rem;color:#1F1D1B;margin-bottom:0\.15rem">([^<]+)<\/div><div style="font-size:0\.82rem;color:#8C877F;margin-bottom:0\.25rem">([^<]+)<\/div><p style="margin:0;font-size:0\.91rem;line-height:1\.6;color:#5C5852">([\s\S]*?)<\/p>/g;
  const cards: CardSlice[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    cards.push({ name: decode(m[1]!), body: decode(m[3]!) });
  }
  return cards;
}

function findCardByName(cards: CardSlice[], nameFragment: string): CardSlice | undefined {
  return cards.find((c) => c.name.includes(nameFragment));
}

function extractSectionBody(html: string, heading: string): string {
  const idx = html.indexOf(heading);
  if (idx === -1) return '';
  const pStart = html.indexOf('<p ', idx);
  const open = pStart === -1 ? -1 : html.indexOf('>', pStart);
  const close = open === -1 ? -1 : html.indexOf('</p>', open);
  if (open === -1 || close === -1) return '';
  return decode(html.slice(open + 1, close));
}

// ── Fixtures (exact chains from the E-5B.5B Preview-QA task spec) ──

const PHASE_K: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Phase K',
  systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
  systemChain: {
    names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Pontus II is an R2R DAC with warm, slightly euphonic character.',
    'The CS600X is a push-pull tube integrated using 6L6GC output stages.',
    'The O/96 is a high-efficiency wide-baffle dynamic loudspeaker.',
  ],
  keepRecommendations: [
    { name: 'Leben CS600X', reason: 'Amp.' },
    { name: 'DeVore O/96', reason: 'Speaker.' },
  ],
  upgradeDirection: 'Refinement at source.',
};

const NAIM_FULL: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Naim full ecosystem',
  systemChain: {
    names: ['Naim NDX 2', 'Naim XPS DR', 'Naim Supernait 3', 'Falcon Acoustics LS3/5a'],
    roles: ['Streamer DAC', 'Power Supply', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The NDX 2 streams from network sources.',
    'The XPS DR is an outboard power supply.',
    'The Supernait 3 is a Naim integrated.',
    'The Falcon LS3/5a is a BBC-tradition stand-mount.',
  ],
  keepRecommendations: [
    { name: 'Naim Supernait 3', reason: 'Anchor.' },
    { name: 'Falcon LS3/5a', reason: 'Destination.' },
  ],
};

const REGA_3: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Rega ecosystem',
  systemChain: {
    names: ['Rega Planar 10', 'Rega Aethos', 'Rega RX5'],
    roles: ['Turntable', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: ['Planar 10.', 'Aethos.', 'RX5.'],
  keepRecommendations: [
    { name: 'Rega Planar 10', reason: 'Anchor.' },
    { name: 'Rega RX5', reason: 'Destination.' },
  ],
};

const QUAD_PAIR: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Quad ESL pair',
  systemChain: {
    names: ['Quad II Classic', 'Quad ESL-57'],
    roles: ['Tube Power Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Quad II Classic delivers tube power suited to ESL panels.',
    'The Quad ESL-57 is a full-range dipole electrostatic loudspeaker.',
  ],
  keepRecommendations: [
    { name: 'Quad II Classic', reason: 'Amp.' },
    { name: 'Quad ESL-57', reason: 'Destination.' },
  ],
};

const FOCAL_SOPRA: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Focal Sopra chain',
  systemChain: {
    names: ['dCS Rossini', 'Pass Labs INT-60', 'Focal Sopra'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: ['Rossini.', 'INT-60.', 'Sopra.'],
  keepRecommendations: [
    { name: 'Pass Labs INT-60', reason: 'Anchor.' },
    { name: 'Focal Sopra', reason: 'Destination.' },
  ],
};

const COMMERCIAL: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'WiiM commercial chain',
  systemChain: {
    names: ['WiiM Pro Plus', 'Hegel H190', 'KEF Blade Two Meta'],
    roles: ['Streamer DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: ['Pro Plus.', 'H190.', 'Blade Two Meta.'],
  keepRecommendations: [
    { name: 'KEF Blade Two Meta', reason: 'Destination.' },
    { name: 'WiiM Pro Plus', reason: 'Source.' },
  ],
};

const HEADPHONE: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Headphone system',
  systemChain: {
    names: ['Chord Hugo TT2', 'Pass Labs HPA-1', 'Focal Utopia'],
    roles: ['DAC', 'Headphone Amplifier', 'Headphone'],
  },
  componentReadings: ['TT2.', 'HPA-1.', 'Utopia.'],
  keepRecommendations: [
    { name: 'Pass Labs HPA-1', reason: 'Anchor.' },
    { name: 'Focal Utopia', reason: 'Destination.' },
  ],
};

// ── Test setup ──────────────────────────────────────────────────────

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});

// ── Group 1 — flag ON expectations ──────────────────────────────────

describe('Preview QA — Phase K', () => {
  it('DeVore brand sentence appears; Leben stays silent; no duplicate prose', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(PHASE_K);
    const cards = extractCardSlices(html);
    const devore = findCardByName(cards, 'DeVore');
    const leben = findCardByName(cards, 'Leben');
    expect(devore).toBeDefined();
    expect(leben).toBeDefined();

    // DeVore brand sentence appears (systemBuildingLogic surfaces after
    // redundancy on wide-baffle/high-efficiency suppresses the first
    // two priority fields).
    expect(devore!.body).toContain('Orangutan models specifically tend to anchor');

    // Leben card stays silent — the new push-pull-anchored systemBuildingLogic
    // is redundancy-suppressed because the existing facts phrase
    // contains push-pull.
    expect(leben!.body).not.toContain('Push-pull tube integrated amplifiers');
    expect(leben!.body).not.toContain('Within the Leben line, the CS600 series');
    expect(leben!.body).not.toContain('CS300 / CS600');

    // No duplicate brand prose — the DeVore sentence appears at most once.
    const devoreMatches = html.match(/Orangutan models specifically tend to anchor/g) ?? [];
    expect(devoreMatches.length).toBe(1);

    // §10 caution surfaces (DeVore upgradeCautions[0] passes shape).
    const section10 = extractSectionBody(html, 'If You Were to Change Something');
    expect(section10).toContain('Orangutan line voicing is distinct from Gibbon');
  });
});

describe('Preview QA — Naim', () => {
  it('Supernait gets ONE PRaT sentence; XPS DR is support-only; §8 Naim ecosystem appears', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_FULL);
    const cards = extractCardSlices(html);
    const ndx = findCardByName(cards, 'Naim NDX 2');
    const xps = findCardByName(cards, 'Naim XPS DR');
    const supernait = findCardByName(cards, 'Naim Supernait 3');

    expect(ndx).toBeDefined();
    expect(xps).toBeDefined();
    expect(supernait).toBeDefined();

    // Supernait card: PRaT sentence appears once
    expect(supernait!.body).toContain('PRaT');
    expect(supernait!.body).toContain('discrete signal path');

    // NDX 2 card: silent for Naim (per-section dedup chose Supernait)
    expect(ndx!.body).not.toContain('PRaT');
    expect(ndx!.body).not.toContain('discrete signal path');

    // XPS DR is support-only — Phase E-2 auxiliary template
    expect(xps!.body).toContain('does not sit in the audio signal path directly');
    expect(xps!.body).not.toContain('PRaT');
    expect(xps!.body).not.toContain('discrete signal path');

    // §8 Naim ecosystem sentence appears
    const section8 = extractSectionBody(html, 'Why This System Works');
    expect(section8).toContain('Within the Naim ecosystem');

    // Naim sentence appears exactly once across all §5 cards
    const naimMatches = html.match(/discrete signal path and tight coupling/g) ?? [];
    expect(naimMatches.length).toBe(1);
  });
});

describe('Preview QA — Rega', () => {
  it('Only RX5 gets the Rega sentence; §8 Rega ecosystem appears', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(REGA_3);
    const cards = extractCardSlices(html);
    const p10 = findCardByName(cards, 'Rega Planar 10');
    const aethos = findCardByName(cards, 'Rega Aethos');
    const rx5 = findCardByName(cards, 'Rega RX5');

    expect(p10).toBeDefined();
    expect(aethos).toBeDefined();
    expect(rx5).toBeDefined();

    // Only RX5 gets the Rega sentence
    expect(rx5!.body).toContain('cross-component design');
    expect(p10!.body).not.toContain('cross-component design');
    expect(aethos!.body).not.toContain('cross-component design');

    // §8 Rega ecosystem sentence appears
    const section8 = extractSectionBody(html, 'Why This System Works');
    expect(section8).toContain('Within-brand Rega partnering');

    // Rega appears exactly once across §5
    const regaMatches = html.match(/cross-component design — turntables, electronics, and loudspeakers/g) ?? [];
    expect(regaMatches.length).toBe(1);
  });
});

describe('Preview QA — Quad', () => {
  it('ESL gets electrostatic sentence; Quad II stays silent; §10 caution appears', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_PAIR);
    const cards = extractCardSlices(html);
    const quad2 = findCardByName(cards, 'Quad II Classic');
    const esl = findCardByName(cards, 'Quad ESL-57');

    expect(quad2).toBeDefined();
    expect(esl).toBeDefined();

    // ESL-57 gets electrostatic sentence
    expect(esl!.body).toContain('Electrostatic loudspeaker family');

    // Quad II Classic stays silent (appliesToRoles narrowed to speaker
    // in E-5B.2A; amplifier role no longer eligible)
    expect(quad2!.body).not.toContain('Electrostatic loudspeaker family');

    // §10 caution appears
    const section10 = extractSectionBody(html, 'If You Were to Change Something');
    expect(section10).toContain('ESL panels are amplifier-sensitive');
  });
});

describe('Preview QA — Focal', () => {
  it('No phrase "brand-level claims should be scoped" anywhere in the render', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(FOCAL_SOPRA);
    expect(html).not.toContain('brand-level claims should be scoped');
    expect(html).not.toContain('brand-level claims');

    // Spot-check that the new (cleaned) Focal houseVoicing surfaces.
    const cards = extractCardSlices(html);
    const focal = findCardByName(cards, 'Focal Sopra');
    expect(focal).toBeDefined();
    expect(focal!.body).toContain('Beryllium-tweeter top-end extension');
    expect(focal!.body).toContain("brand's distinctive driver lineage");
  });
});

describe('Preview QA — WiiM commercial', () => {
  it('No WiiM brand prose anywhere; KEF Blade still gets a brand sentence (mixed-tier eligible)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(COMMERCIAL);
    const cards = extractCardSlices(html);
    const wiim = findCardByName(cards, 'WiiM Pro Plus');
    const kef = findCardByName(cards, 'KEF Blade');

    expect(wiim).toBeDefined();
    expect(kef).toBeDefined();

    // No WiiM brand voicing — commercial entry has no houseVoicing /
    // designPhilosophy / systemBuildingLogic by construction, and the
    // commercial hard-gate also suppresses.
    expect(wiim!.body).not.toContain('streaming entry');
    expect(wiim!.body).not.toContain('Roon Ready');
    expect(wiim!.body).not.toContain('functional category');

    // KEF Blade (R-series+ tier, non-commercial-effective) gets Uni-Q
    // sentence — sanity check that the surface is operating, not just
    // globally silent.
    expect(kef!.body).toContain('Uni-Q');
  });
});

describe('Preview QA — Headphone', () => {
  it('All brand-house-voicing prose remains silent across §5 / §8 / §10', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(HEADPHONE);
    const cards = extractCardSlices(html);
    const tt2 = findCardByName(cards, 'Chord Hugo TT2');
    const hpa = findCardByName(cards, 'Pass Labs HPA-1');
    const utopia = findCardByName(cards, 'Focal Utopia');

    expect(tt2).toBeDefined();
    expect(hpa).toBeDefined();
    expect(utopia).toBeDefined();

    // No brand sentences on any card (headphone-system skip)
    expect(tt2!.body).not.toContain('FPGA-driven DAC line');
    expect(tt2!.body).not.toContain('Ring DAC');
    expect(hpa!.body).not.toContain('Class-A solid-state');
    expect(utopia!.body).not.toContain('Beryllium-tweeter');
    expect(utopia!.body).not.toContain('inverted-dome midrange');

    // §8 brand-cluster sentence absent
    const section8 = extractSectionBody(html, 'Why This System Works');
    expect(section8).not.toContain('Within the');

    // §10 brand caution absent
    const section10 = extractSectionBody(html, 'If You Were to Change Something');
    expect(section10).not.toContain('lineage');
    expect(section10).not.toContain('Heritage line is distinct');
  });
});

// ── Group 2 — flag OFF byte-equivalence ─────────────────────────────

describe('Preview QA — flag OFF byte-equivalence (no brand voicing leaks)', () => {
  it('every fixture renders without any brand-house-voicing prose', () => {
    const brandPhrases = [
      'discrete signal path and tight coupling',
      'cross-component design — turntables',
      'Electrostatic loudspeaker family',
      'Orangutan models specifically tend to anchor',
      'Beryllium-tweeter top-end extension',
      'Ring DAC architecture',
      'Uni-Q point-source coaxial',
      'Within the Naim ecosystem',
      'Within-brand Rega partnering',
      'ESL panels are amplifier-sensitive',
      'Heritage line is distinct',
    ];
    for (const fixture of [PHASE_K, NAIM_FULL, REGA_3, QUAD_PAIR, FOCAL_SOPRA, COMMERCIAL, HEADPHONE]) {
      const html = render(fixture);
      for (const phrase of brandPhrases) {
        expect(html, `flag-OFF leak in "${fixture.subject}": "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});
