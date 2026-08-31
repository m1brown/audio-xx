/**
 * Deterministic fact computation for the governed reasoning lane
 * (Substrate Doctrine, build item 2).
 *
 * APPLICATION COMPUTES THE FACT. MODEL INTERPRETS ITS SIGNIFICANCE.
 *
 * Every computation here is arithmetic over licensed figures, reuses the
 * SAME trusted machinery the editorial artifact uses (interface-conclusions),
 * and travels with the figures it rests on plus its limitations. Nothing
 * here states a preference, a recommendation, or a sonic outcome.
 */
import { dossierFor } from '@/lib/evidence/product-dossier';
import { presentDossier, type DossierView } from '@/lib/evidence/dossier-presentation';
import { interfaceConclusions, ohms, wattsAtStatedLoad } from '@/lib/artifact/interface-conclusions';
import { readFacts } from '@/lib/evidence/manufacturer-fact-store';
import { isMakerPublished, productKeyFor } from '@/lib/evidence/manufacturer-facts';
import { FRANCE_FACTS } from '@/lib/evidence/france-product-facts';
import { NATHAN_FACTS } from '@/lib/evidence/nathan-product-facts';
import { observationKeyFor } from './evidence-retrieval';
import type { ComputedFact } from './governed-context';

const norm = (s: string) => s.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Server-side dossier view over held + authored evidence, arithmetic-grade. */
async function viewFor(displayName: string, role: string, now: number): Promise<DossierView> {
  const key = norm(displayName);
  const storeKey = productKeyFor(displayName);
  const held = (await readFacts(storeKey, now)).map((f) => {
    const sourceUrl = f.attribution?.sourceUrl;
    return {
      field: String(f.field), value: String(f.value), sourceUrl,
      sourceClass: (sourceUrl && isMakerPublished(sourceUrl, displayName)
        ? 'maker_published' : 'third_party_reported') as 'maker_published' | 'third_party_reported',
    };
  });
  // Authored facts are filed under the CANONICAL key ("audio research
  // reference 5"); the listener types "ARC ref 5". Resolve through the same
  // governed identity table and remap, exactly as the artifact path does.
  const factKey = observationKeyFor(displayName);
  const authoredFacts = [...FRANCE_FACTS, ...NATHAN_FACTS]
    .filter((f) => f.productKey === factKey)
    .map((f) => (factKey !== key ? { ...f, productKey: key } : f));
  return presentDossier(dossierFor(key, displayName, { authoredFacts, heldSpecs: held, role }));
}

function allLines(v: DossierView): Array<{ label: string; value: string }> {
  return [...v.primary, ...v.secondary];
}

function speakerLoad(v: DossierView | undefined): number | undefined {
  if (!v) return undefined;
  const line = allLines(v).find((l) => /impedance/i.test(l.label) && ohms(l.value) !== undefined);
  return ohms(line?.value);
}

function powerLine(v: DossierView | undefined): { label: string; value: string } | undefined {
  if (!v) return undefined;
  return allLines(v).find((l) => /power\s*output|power$/i.test(l.label) && /w(att)?s?\b/i.test(l.value));
}

export interface ComputedFactsInput {
  components: Array<{ displayName: string; role: string }>;
  /** One-slot hypothetical: candidate evaluated in the incumbent's position. */
  hypothetical?: { candidate: string; incumbent: string } | null;
  now?: number;
}

/**
 * Interface facts for the ACTIVE chain, plus — when a hypothetical amplifier
 * substitution is in play — the evidenced power delta at the loudspeaker's
 * stated load.
 */
export async function buildComputedFacts(input: ComputedFactsInput): Promise<ComputedFact[]> {
  const now = input.now ?? Date.now();
  const out: ComputedFact[] = [];
  const views = new Map<string, DossierView>();
  for (const c of input.components) {
    views.set(c.displayName, await viewFor(c.displayName, c.role, now));
  }

  // 1. The same interface conclusions the editorial artifact trusts.
  for (const ic of interfaceConclusions(
    input.components,
    input.components.map((c) => views.get(c.displayName)!),
  )) {
    out.push({
      kind: ic.kind,
      statement: ic.statement,
      restsOn: ic.restsOn,
      limitations: ic.status === 'unknown'
        ? 'This interface could not be computed; the statement records what is missing.'
        : 'Electrical behaviour only; establishes nothing about tone or character.',
    });
  }

  // 2. Hypothetical power delta at the loudspeaker's stated load.
  const hyp = input.hypothetical;
  if (hyp) {
    const speaker = input.components.find((c) => /speaker/i.test(c.role));
    const load = speakerLoad(speaker ? views.get(speaker.displayName) : undefined);
    const candView = await viewFor(hyp.candidate, 'amplifier', now);
    const incView = views.get(hyp.incumbent) ?? await viewFor(hyp.incumbent, 'amplifier', now);
    const candPower = powerLine(candView);
    const incPower = powerLine(incView);
    if (candPower && incPower) {
      const at = (line: { value: string }): { w: number; atLoad: boolean } | undefined => {
        const atLoad = load !== undefined ? wattsAtStatedLoad(line.value, load) : undefined;
        if (atLoad !== undefined) return { w: atLoad, atLoad: true };
        const any = Number((/([\d.,]+)\s*w/i.exec(line.value)?.[1] ?? '').replace(/,/g, ''));
        return Number.isFinite(any) && any > 0 ? { w: any, atLoad: false } : undefined;
      };
      const cw = at(candPower);
      const iw = at(incPower);
      if (cw !== undefined && iw !== undefined) {
        const loadClause = load === undefined
          ? '.'
          : cw.atLoad && iw.atLoad
            ? `, both read at the loudspeaker's stated ${load}-ohm load.`
            : `. The loudspeaker's stated load is ${load} ohms; where a maker publishes no figure at that load, the figure shown is at the maker's own stated condition.`;
        out.push({
          kind: 'power_delta',
          statement: `Rated power in the amplifier position changes from ${iw.w}W (${hyp.incumbent}) `
            + `to ${cw.w}W (${hyp.candidate})${loadClause}`,
          restsOn: [
            `${hyp.incumbent}: ${incPower.value}`,
            `${hyp.candidate}: ${candPower.value}`,
            ...(load !== undefined && speaker ? [`${speaker.displayName}: nominal ${load} ohms`] : []),
          ],
          limitations: 'Rated figures under the makers’ stated conditions; real delivery into the actual load is not established.',
        });
      }
    }
  }

  // 3. Duplicated functional stages — structural, no arithmetic needed.
  const roles = input.components.map((c) => ({ ...c, r: c.role.toLowerCase() }));
  const dacs = roles.filter((c) => /\bdac\b|streamer_dac/.test(c.r));
  if (dacs.length >= 2) {
    out.push({
      kind: 'duplicate_stage',
      statement: `Two components hold digital-to-analogue conversion in this chain: ${dacs.map((d) => d.displayName).join(' and ')}. One conversion stage is redundant in a single signal path.`,
      restsOn: dacs.map((d) => `${d.displayName}: role ${d.role}`),
      limitations: 'Says nothing about which stage is better; only that both exist.',
    });
  }
  return out;
}
