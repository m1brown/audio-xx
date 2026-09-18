/**
 * Suggested Edits — Slice 1 pins.
 *
 * Two things are being held: the capture contract (what a contribution
 * must and must not contain) and the ABSOLUTE TRUST BOUNDARY — a pending
 * contribution is inert. It cannot alter catalog facts, create evidence,
 * touch identity, or reach the reasoning lane, and the separation is
 * pinned structurally (imports and write targets), not just asserted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateContributionInput, CONTRIBUTION_REASONS,
} from '../contribution-store';

const VALID = {
  surface: 'dossier_card',
  productName: 'JOB INTegrated',
  reason: 'wrong',
  text: 'The manual lists a different nominal impedance.',
  sourceUrl: 'https://example.com/manual.pdf',
};

describe('capture contract — validation', () => {
  it('a complete submission validates', () => {
    expect(validateContributionInput(VALID)).toBeNull();
  });

  it('all four user-facing reasons are accepted, nothing else', () => {
    expect([...CONTRIBUTION_REASONS]).toEqual(['wrong', 'missing', 'wrong_product', 'owner_info']);
    for (const reason of CONTRIBUTION_REASONS) {
      expect(validateContributionInput({ ...VALID, reason })).toBeNull();
    }
    expect(validateContributionInput({ ...VALID, reason: 'evidence_class_override' })).not.toBeNull();
  });

  it('text is required; empty and whitespace submissions are rejected', () => {
    expect(validateContributionInput({ ...VALID, text: '' })).not.toBeNull();
    expect(validateContributionInput({ ...VALID, text: '   ' })).not.toBeNull();
    expect(validateContributionInput({ ...VALID, text: 'x'.repeat(4001) })).not.toBeNull();
  });

  it('source URL is optional but must be a plausible http(s) URL when given', () => {
    expect(validateContributionInput({ ...VALID, sourceUrl: undefined })).toBeNull();
    expect(validateContributionInput({ ...VALID, sourceUrl: '' })).toBeNull();
    expect(validateContributionInput({ ...VALID, sourceUrl: 'javascript:alert(1)' })).not.toBeNull();
    expect(validateContributionInput({ ...VALID, sourceUrl: 'not a url' })).not.toBeNull();
    expect(validateContributionInput({ ...VALID, sourceUrl: 'ftp://example.com/x' })).not.toBeNull();
  });

  it('a known product reference persists as productName/productKey; an unknown one as the user\'s own words', () => {
    // Known identity: productName present is sufficient.
    expect(validateContributionInput({ ...VALID })).toBeNull();
    // Unknown product: typedProduct carries the user's wording, unconverted.
    expect(validateContributionInput({
      surface: 'dossier_card_sparse', typedProduct: 'WLM La Scala mkI (older crossover)',
      reason: 'owner_info', text: 'I own a pair; the early crossover differs.',
    })).toBeNull();
    // No product reference at all is rejected.
    expect(validateContributionInput({
      surface: 'dossier_card', reason: 'missing', text: 'Missing info.',
    })).not.toBeNull();
  });

  it('oversized context fields are rejected (abuse control)', () => {
    expect(validateContributionInput({ ...VALID, surface: 'x'.repeat(201) })).not.toBeNull();
    expect(validateContributionInput({ ...VALID, typedProduct: 'x'.repeat(201) })).not.toBeNull();
  });
});

describe('ABSOLUTE TRUST BOUNDARY — contributions are inert', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
  const STORE = read('../contribution-store.ts');
  const ROUTE = read('../../../app/api/contributions/route.ts');

  it('the contribution store imports nothing from evidence, catalog, identity, or reasoning', () => {
    const imports = STORE.match(/^import .+$/gm) ?? [];
    for (const line of imports) {
      expect(line, line).not.toMatch(/evidence|catalog|products|consultation|reasoning|identity|review/);
    }
    // Its only dependency is the prisma client.
    expect(imports.join('\n')).toContain("from '../prisma'");
  });

  it('the store and route write ONLY to ContributionV1 — no other table, no evidence writer', () => {
    for (const src of [STORE, ROUTE]) {
      for (const m of src.match(/INSERT INTO "([^"]+)"|UPDATE "([^"]+)"|DELETE FROM "([^"]+)"/g) ?? []) {
        expect(m).toContain('ContributionV1');
      }
      expect(src).not.toMatch(/writeFacts|writeReview|OwnerReport|PRODUCT_IDENTITIES|EvidenceItem/);
    }
  });

  it('a contribution begins pending — the only status Slice 1 can create', () => {
    expect(STORE).toContain("'pending'");
    expect(STORE).not.toMatch(/'accepted'|'rejected'|'partially_accepted'/);
  });

  it('nothing in the reasoning lane or evidence layer reads contributions', () => {
    // Match the MODULE's identifiers, not the English word — evidence prose
    // legitimately says "each component's contribution".
    const MODULE_REFS = /contribution-store|ContributionV1|writeContribution|listContributions|recentContributionCount/;
    const roots = ['../../reasoning', '../../evidence'];
    for (const root of roots) {
      const dir = join(__dirname, root);
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
        const src = readFileSync(join(dir, f), 'utf8');
        expect(src, `${root}/${f} must not know the contribution store exists`)
          .not.toMatch(MODULE_REFS);
      }
    }
  });

  it('the reasoning-lane route does not touch contributions', () => {
    const lane = read('../../../app/api/reasoning-lane/route.ts');
    expect(lane).not.toMatch(/contribution-store|ContributionV1|writeContribution/);
  });
});

describe('UI placement pins', () => {
  const DOSSIERS = readFileSync(
    join(__dirname, '../../../components/advisory/ComponentDossiers.tsx'), 'utf8',
  );
  const SHEET = readFileSync(
    join(__dirname, '../../../components/SuggestEdit.tsx'), 'utf8',
  );

  it('the dossier card carries the affordance, with the sparse variant on empty cards', () => {
    expect(DOSSIERS).toContain('<SuggestEdit');
    expect(DOSSIERS).toContain("'dossier_card_sparse'");
  });

  it('the sheet keeps the approved copy and exposes no internal vocabulary', () => {
    expect(SHEET).toContain('Suggest an edit');
    expect(SHEET).toContain('Know this product?');
    expect(SHEET).toContain('A person reviews every suggestion');
    // Internal vocabulary must not reach USER-FACING strings — scan the
    // source with comments stripped, since the doc header may legitimately
    // name the concepts it is keeping out of the UI.
    const rendered = SHEET.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const internal of ['EvidenceClass', 'EvidenceTier', 'provenance', 'moderation', 'evidence tier']) {
      expect(rendered).not.toContain(internal);
    }
  });

  it('the sheet never sends free text to analytics — only shape flags', () => {
    const trackCalls = SHEET.match(/trackEvent\([^)]+\)/gs) ?? [];
    expect(trackCalls.length).toBeGreaterThanOrEqual(2);
    for (const c of trackCalls) {
      expect(c).not.toMatch(/text|sourceUrl:\s*sourceUrl/);
    }
  });
});
