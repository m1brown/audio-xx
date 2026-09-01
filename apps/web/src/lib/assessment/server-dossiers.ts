/**
 * Component dossiers, built on the SERVER.
 *
 * `buildDossierViews` in page.tsx is a client function: it reaches the
 * evidence store through API routes because a browser has no other way in.
 * The artifact route runs on the server and had no equivalent, so a shared or
 * printed assessment rendered SYSTEM REVIEW and EVIDENCE with nothing between
 * them — no YOUR SYSTEM at all, on the surface most likely to be read by
 * someone other than the listener who generated it.
 *
 * Same evidence, same presentation decisions, same governed image boundary.
 * The only difference is that the store is read directly rather than over
 * HTTP, so there is one fewer hop and no deadline to miss.
 *
 * READ ONLY. Nothing here acquires: a first encounter with a product
 * legitimately holds nothing, and absence is a state the licensing layer
 * already handles.
 */
import { presentDossier, type DossierView } from '../evidence/dossier-presentation';
import { dossierFor } from '../evidence/product-dossier';
import { readFacts } from '../evidence/manufacturer-fact-store';
import { isMakerPublished, productKeyFor } from '../evidence/manufacturer-facts';
import { getProductImageEntry } from '../product-images';
import { normalizeRole } from './authoritative';

export interface ServerDossierInput {
  name: string;
  /** The engine's display label; normalised here. */
  role?: string;
  /** A corroborated canonical designation, where one was established. */
  canonicalName?: string;
}

/**
 * Build one dossier per component. Never throws: a store failure yields a
 * dossier without held specifications rather than no assessment.
 */
export async function buildServerDossiers(
  components: ServerDossierInput[],
): Promise<DossierView[]> {
  const now = Date.now();

  const views = await Promise.all(components.map(async (c) => {
    const key = productKeyFor(c.name);

    let heldSpecs: Array<{
      field: string; value: string; sourceUrl?: string;
      sourceClass: 'maker_published' | 'third_party_reported';
    }> = [];
    try {
      heldSpecs = (await readFacts(key, now)).map((m) => {
        const sourceUrl = m.attribution?.sourceUrl;
        return {
          field: String(m.field),
          value: String(m.value),
          sourceUrl,
          // Decided where the URL is known. `isMakerPublished` is stricter
          // than the admission test on purpose: admission asks whether a
          // document is close enough to the product's own web presence to
          // hold; classification asks whether Audio XX may tell a reader the
          // MANUFACTURER published it. The fact is kept either way.
          sourceClass: (sourceUrl && isMakerPublished(sourceUrl, c.name)
            ? 'maker_published' : 'third_party_reported'),
        };
      });
    } catch {
      // A store failure is not evidence that a product has no specifications.
      heldSpecs = [];
    }

    const role = normalizeRole(c.role) ?? '';
    const view = presentDossier(dossierFor(key, c.name, { heldSpecs, role } as never));

    /*
     * The governed image boundary, resolved against the CORROBORATED identity
     * where one exists and the listener's words only otherwise. Nothing
     * admissible yields `undefined`, which every surface renders as nothing at
     * all — no frame, no placeholder.
     */
    const admitted = (c.canonicalName && getProductImageEntry(undefined, c.canonicalName))
      || getProductImageEntry(undefined, c.name);

    return {
      ...view,
      role,
      ...(admitted ? { image: { url: admitted.url, credit: admitted.source?.credit } } : {}),
    } as DossierView;
  }));

  return views;
}
