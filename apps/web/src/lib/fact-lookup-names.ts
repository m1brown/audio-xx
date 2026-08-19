/**
 * Which product names to ask the manufacturer-fact store about.
 *
 * ONE derivation, used by the web assessment and the server-rendered
 * artifact, because two call sites composing this separately is how the
 * surfaces came to ask about different products in the first place.
 *
 * Three sources, and each is here because the other two miss something:
 *
 *   1. SUBJECT MATCHES resolve against the catalogue, so they name only
 *      products we already know — the set that needs manufacturer evidence
 *      least.
 *   2. THE LISTENER'S OWN LABELS ("Speakers: Acora QRC-2") name the
 *      uncatalogued components, which is the primary case the whole
 *      manufacturer-evidence path exists for.
 *   3. THE CATALOGUE'S CANONICAL NAME closes the last gap. Facts are stored
 *      under the name the acquiring path resolved — "Denafrips Pontus II
 *      12th-1" — while a listener writes "Denafrips Pontus II", and
 *      `productKeyFor` normalises case but not identity, so those are two
 *      different keys and the stored fact is unreachable.
 *
 * (3) is not redundant with catalogue coverage: 46% of catalogued
 * loudspeakers carry no `sensitivity_db`, so a Klipsch Heresy IV is exactly
 * the case where the maker's published figure decides whether a pairing can
 * be assessed at all — and exactly the case a key mismatch loses.
 *
 * Asking about a name we hold nothing for costs one store read that returns
 * empty. Failing to ask costs the assessment.
 */

import { factCandidateNames } from './evidence/manufacturer-facts';
import { findProductByComponentName } from './catalog/lookups';

export interface FactLookupSubject {
  name: string;
  kind: string;
  parenthetical?: boolean;
}

/**
 * @param subjects Catalogue-resolved subject matches for the message.
 * @param labelled Components the listener labelled, from the labelled parse.
 */
export function factLookupNames(
  subjects: ReadonlyArray<FactLookupSubject>,
  labelled: ReadonlyArray<{ rawName?: string }> = [],
): string[] {
  const base = factCandidateNames(subjects, labelled);

  // The canonical form of anything that resolves to a catalogue product.
  // `factCandidateNames` dedupes by product key, so a canonical name equal to
  // what the listener already wrote adds nothing.
  const canonical: Array<{ rawName: string }> = [];
  for (const name of base) {
    const product = findProductByComponentName(name);
    if (product) canonical.push({ rawName: `${product.brand} ${product.name}` });
  }

  return factCandidateNames(subjects, [...labelled, ...canonical]);
}
