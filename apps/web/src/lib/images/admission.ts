/**
 * Image admission — one boundary, three independent predicates.
 *
 * GOVERNING INVARIANT (founder, 2026-08-23):
 *
 *   A user-visible product image is fully admissible only when all three are
 *   INDEPENDENTLY established:
 *     1. exact identity — exact product and variant;
 *     2. approved provenance — manufacturer or verified authorized dealer;
 *     3. an affirmative RECORDED basis to reproduce or display it.
 *
 *   None may be inferred from another.
 *
 * IMAGES HAVE ZERO EVIDENTIARY AUTHORITY. An image may never establish
 * identity for another evidence object, license a ProductFact, enter a
 * calculation, become a D-12 premise, or support an interpretation or a
 * recommendation. Presentation, never evidence.
 *
 * NO IMAGE IS PREFERABLE TO THE WRONG IMAGE. Absence is a normal finished
 * state, and there is no coverage target.
 *
 * WHY THE STATE IS DERIVED. Storing an editorial verdict beside the metadata
 * that justifies it creates two sources of truth that drift — the defect that
 * produced three different values for one tonal axis. `admissionState` is a
 * pure function of the atomic fields; there is nothing to keep in step.
 */

/**
 * What is known about the asset's identity — independent of who hosts it.
 *
 * `corroborated` deliberately is NOT `verified`. The asset URL carrying the
 * model tokens is a DEFECT DETECTOR, not an admission mechanism: it catches
 * `L2i` pointing at `L2i-SE-Front-Silver-1.jpg`, but a matching filename
 * proves nothing on its own — filenames are written by people too. Only a
 * human check against the source page yields `verified_exact`.
 */
export type IdentityStatus =
  | 'verified_exact'
  | 'corroborated'
  | 'unverified'
  | 'known_wrong';

export type ImageSourceClass =
  | 'manufacturer'
  | 'authorized_dealer'
  | 'review_publication'
  | 'retailer'
  | 'catalog'
  | 'unclassified';

/** How Audio XX is entitled to reproduce the asset. Never inferred. */
export type RightsBasis =
  | 'media_kit'
  | 'written_permission'
  | 'published_terms'
  | 'none_recorded';

export type Hosting = 'local' | 'remote';

export interface GovernedImage {
  /** The exact product this asset claims to depict. */
  key: string;
  url: string;
  identityStatus: IdentityStatus;
  sourceClass: ImageSourceClass;
  rightsBasis: RightsBasis;
  hosting: Hosting;
  sourceUrl?: string;
  termsUrl?: string;
  rightsCheckedAt?: string;
  credit?: string;
  captured?: string;
  /** Why identity was judged wrong or unverified. Audit trail, never shown. */
  identityNote?: string;
}

export type AdmissionState =
  /** All three predicates established. Display freely. */
  | 'admissible'
  /**
   * TEMPORARY. A correctly identified manufacturer or verified-dealer asset
   * whose rights basis has never been recorded. Grandfathered so a
   * recordkeeping gap does not withdraw correct imagery from readers — but
   * this is a deadline, not a permanent class. New assets never enter it.
   */
  | 'legacy_rights_pending'
  | 'identity_unverified'
  | 'provenance_ineligible'
  | 'identity_wrong';

const APPROVED_PROVENANCE: ImageSourceClass[] = ['manufacturer', 'authorized_dealer'];

/**
 * Derive the admission state. Ordered most severe first, because the
 * responses differ: a wrong image is a correctness defect, prohibited
 * provenance is a display decision, and missing rights records are a deadline.
 */
export function admissionState(img: GovernedImage): AdmissionState {
  if (img.identityStatus === 'known_wrong') return 'identity_wrong';
  if (!APPROVED_PROVENANCE.includes(img.sourceClass)) return 'provenance_ineligible';
  if (img.identityStatus !== 'verified_exact' && img.identityStatus !== 'corroborated') {
    return 'identity_unverified';
  }
  if (img.rightsBasis === 'none_recorded') return 'legacy_rights_pending';
  if (img.identityStatus !== 'verified_exact') return 'legacy_rights_pending';
  return 'admissible';
}

/**
 * ENFORCEMENT STAGING — read this before changing it.
 *
 * The invariant above is not staged. `admissionState` always computes the
 * true state, and the audit always reports it truthfully. What is staged is
 * the WITHDRAWAL of imagery that pre-dates the invariant.
 *
 * Applying every predicate at once suppresses 143 of 156 registry entries,
 * because 93 rows were written before provenance was recorded at all and
 * carry no source block. Those images are not known to be wrong; they are
 * unaccounted for. Removing nearly all photography from the product surface
 * is a product decision with a measured cost, and it belongs to the founder,
 * not to a refactor that was asked to close correctness bypasses.
 *
 * So enforcement runs in two levels:
 *
 *   'identity'  — withhold assets that are WRONG or from a PROHIBITED source.
 *                 Both are correctness: a wrong-variant photograph misinforms
 *                 the reader, and a review-publication or retailer asset is
 *                 excluded by standing doctrine (F4, Tier I/II).
 *
 *   'full'      — additionally withhold every asset whose identity or
 *                 provenance was never established. This is the invariant in
 *                 full, and the intended end state.
 *
 * This is a deadline, not a permanent design. `legacy_rights_pending` and
 * `identity_unverified` are visibly temporary classes, and the audit artifact
 * reports the exact cost of each so the decision is made on numbers.
 */
export type EnforcementLevel = 'identity' | 'full';

export const ENFORCEMENT: EnforcementLevel = 'identity';

/**
 * May this asset be shown to a reader?
 *
 * Suppression always RETAINS the record. The URL and the fact that someone
 * curated it are the raw material for verifying or regularising it later;
 * deleting a suppressed row destroys the only evidence of what was checked.
 */
export function isDisplayable(
  img: GovernedImage,
  level: EnforcementLevel = ENFORCEMENT,
): boolean {
  const s = admissionState(img);
  if (hostIsIneligible(img.url)) return false;
  if (s === 'admissible' || s === 'legacy_rights_pending') return true;
  if (level === 'full') return false;
  // Under 'identity', an unestablished predicate is not yet disqualifying —
  // but a KNOWN-WRONG asset and a PROHIBITED source always are.
  return s === 'identity_unverified' || (s === 'provenance_ineligible' && !PROHIBITED.has(img.sourceClass));
}

/**
 * Source classes that may never reach a reader, at any enforcement level.
 *
 * `review_publication` is the standing F4 reviewer-data exclusion.
 * `retailer` is a generic reseller — the JOB Integrated's only asset was one,
 * and coverage was not accepted as a reason to broaden the policy.
 * `catalog` is a URL that survived neither the first-party host test nor any
 * recorded provenance: nothing whatever is known about who published it.
 *
 * WHY `catalog` IS PROHIBITED WHILE `unclassified` IS ONLY STAGED. They are
 * not the same gap. An `unclassified` registry row was curated by hand into a
 * file whose sections group it by maker or dealer, so provenance is informal
 * rather than absent, and withdrawing that legacy imagery is a costed product
 * decision the staging exists to defer. A catalog `imageUrl` has no such
 * record and no host that answers for it — and left ungoverned it would render
 * a DeVore photograph on a KEF product, which the cross-brand leakage
 * invariant forbids outright. That invariant is not staged.
 */
const PROHIBITED = new Set<ImageSourceClass>(['review_publication', 'retailer', 'catalog']);

/**
 * Hosts that are never an approved provenance, whatever a row's tier says.
 *
 * A missing `source` block is not a lenient default, but under staged
 * enforcement it is temporarily tolerated — and that tolerance was letting a
 * used-gear reseller through: `job 225` resolved to a tmraudio.com asset
 * because its row predates provenance recording. The Music Room was ruled
 * ineligible explicitly; a recordkeeping gap must not overturn that ruling.
 *
 * This is a small closed list of vendors already decided on, not an
 * open-ended denylist standing in for the policy. The policy is
 * `classifyHost` + `sourceClass`; this stops one class of gap from
 * outvoting a decision that was already made.
 */
const INELIGIBLE_HOSTS = [
  'tmraudio.com',      // The Music Room — used-gear reseller, ruled ineligible
  'ebay.', 'reverb.com', 'audiogon.com', 'usaudiomart.com', 'hifishark.com',
  '6moons.com',        // standing exclusion — never used, displayed or linked
];

/** Is this asset served by a host that may never supply user-visible imagery? */
export function hostIsIneligible(url: string): boolean {
  const u = url.toLowerCase();
  return INELIGIBLE_HOSTS.some((h) => u.includes(h));
}

/**
 * Variant-significant tokens — the defect detector.
 *
 * Two wrong-variant assets have now surfaced from spot checks alone
 * (`eversolo dmp a6` pointing at a Gen 2 thumbnail, `vinnie rossi l2i`
 * pointing at an L2i-SE photograph), which is reason to assume more and to
 * run this over everything rather than by sampling.
 *
 * It detects DISAGREEMENT between a key and its asset. It never confers
 * identity: an asset whose filename says nothing is `unverified`, not wrong.
 */
const VARIANT_TOKENS = [
  'se', 'apex', 'plus', 'gen2', 'gen', 'mk', 'mkii', 'mkiii', 'mkiv',
  'ii', 'iii', 'iv', 'x', 'tt2', 'tt', 'signature', 'sig', 'master',
  'v2', 'v3', 'pro', 'max', 'mini', 'ltd', 'anniversary',
];

const tokenize = (v: string): string[] =>
  v.toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter(Boolean);

/**
 * Tokenise a URL filename. Deliberately NOT `tokenize`.
 *
 * In a URL a `+` is an encoded SPACE, not the model suffix that distinguishes
 * the Magnepan LRS+ from the LRS. Reading `3+%284%29.jpg` as claiming the
 * "plus" variant accused a correctly-keyed Magico A3 asset of being the wrong
 * product — a detector that cries wolf gets overridden, so it must be quiet
 * where it knows nothing.
 */
const filenameTokens = (url: string): string[] => {
  const filename = url.split('?')[0].split('/').pop() ?? '';
  return decodeURIComponent(filename).toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
};

/**
 * Does the asset URL assert a product the key does not?
 *
 * Returns the offending token, or undefined when they do not disagree.
 * "Do not disagree" is not "agree" — see `IdentityStatus`.
 *
 * Two independent tests, because two different mistakes produce a wrong image:
 *
 *   1. The asset names a VARIANT the key omits — `Heresy-IV` filed under
 *      `klipsch heresy`.
 *   2. A filename token strictly EXTENDS a key token — `Z40i` filed under
 *      `linear tube audio z40`. This is the substring hazard that produced the
 *      original defect, reappearing inside the detector meant to catch it:
 *      `z40` is a substring of `z40i`, so a naive containment check calls the
 *      wrong photograph corroboration.
 */
export function variantDisagreement(key: string, assetUrl: string): string | undefined {
  const keyTokens = new Set(tokenize(key));
  const fileTokens = filenameTokens(assetUrl);
  const fileSet = new Set(fileTokens);

  // Tokenisation differs between a key and a filename for the SAME product:
  // `eversolo dmp a6 gen 2` writes the generation as two tokens, while
  // `eversolo-a6-gen2-thumb.webp` writes it as one. Comparing token sets alone
  // accused a correctly-keyed Gen 2 row of depicting a different product.
  const keyFlat = [...keyTokens].join('');
  const namedInKey = (t: string) => keyTokens.has(t) || keyFlat.includes(t);

  for (const t of VARIANT_TOKENS) {
    // Only the asset claiming a variant the key omits is evidence of a wrong
    // mapping. The reverse — a key naming a variant a terse filename omits —
    // is silence, and silence is `unverified`.
    if (fileSet.has(t) && !namedInKey(t)) return t;
  }

  for (const k of keyTokens) {
    if (k.length < 3 || !/[a-z]/.test(k) || !/[0-9]/.test(k)) continue;
    for (const f of fileTokens) {
      // Bounded: an alphanumeric model token extended by a short suffix is a
      // sibling product. Unbounded, this would match arbitrary CDN hashes.
      if (f !== k && f.startsWith(k) && f.length - k.length <= 3 && !namedInKey(f)) return f;
    }
  }
  return undefined;
}

/**
 * Does the asset URL independently carry the key's model tokens?
 *
 * Token equality, not substring containment: `z40` must appear AS a token, so
 * a `Z40i` photograph does not corroborate a Z40 key.
 */
export function assetCorroboratesKey(key: string, assetUrl: string): boolean {
  const urlTokens = new Set([
    ...filenameTokens(assetUrl),
    ...decodeURIComponent(assetUrl).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' '),
  ]);
  const model = tokenize(key).slice(1);
  if (model.length === 0) return false;
  return model.every((t) => urlTokens.has(t));
}

/**
 * Classify the provenance of a URL that arrived WITHOUT a source block —
 * catalog `imageUrl` fields, which carry no tier, credit, or capture date.
 *
 * WHY THIS IS NOT AN INFERENCE. The invariant forbids deriving one predicate
 * from another: identity may not be assumed from provenance, provenance may
 * not be assumed from rights. Reading the host is none of those. It is the
 * same single observation a human made when they wrote `site: 'goldmund.com',
 * tier: 'manufacturer'` on every registry row — who serves this file. Applying
 * it consistently is what stops the catalog being a second trust boundary with
 * looser rules than the registry.
 *
 * The host must correspond to the BRAND. A `devorefidelity.com` asset on a KEF
 * product is not first-party evidence, it is cross-brand leakage, which is a
 * standing operational invariant in its own right.
 *
 * Establishing the publisher establishes nothing about identity or rights:
 * both are still tested separately, so a first-party catalog URL lands in the
 * same temporary `legacy_rights_pending` class as a first-party registry row.
 */
export function classifyCatalogHost(brand: string | undefined, url: string): ImageSourceClass {
  if (!brand || !url) return 'catalog';
  // A site-relative path is served by Audio XX. Who took the photograph, and
  // under what permission, is not recorded anywhere — hosting it ourselves
  // answers neither question.
  if (url.startsWith('/')) return 'catalog';

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'catalog';
  }
  const flatHost = host.replace(/[^a-z0-9]/g, '');
  const brandTokens = tokenize(brand);
  if (brandTokens.length === 0) return 'catalog';

  // The whole brand name must appear in the host: `kef` in `us.kef.com`,
  // `devore` in `devorefidelity.com`. A single shared token is not enough.
  const flatBrand = brandTokens.join('');
  return flatHost.includes(flatBrand) ? 'manufacturer' : 'catalog';
}

/**
 * The one admission decision for an un-provenanced URL.
 *
 * Returns the URL only when it survives every predicate, so callers cannot
 * accidentally hold a suppressed asset: there is nothing to hold.
 */
export function admitUnregisteredImage(
  brand: string | undefined,
  key: string,
  url: string | undefined,
): string | undefined {
  if (!url) return undefined;
  const disagreement = variantDisagreement(key, url);
  const img: GovernedImage = {
    key,
    url,
    identityStatus: disagreement
      ? 'known_wrong'
      : (assetCorroboratesKey(key, url) ? 'corroborated' : 'unverified'),
    sourceClass: classifyCatalogHost(brand, url),
    rightsBasis: 'none_recorded',
    hosting: url.startsWith('/') ? 'local' : 'remote',
  };
  return isDisplayable(img) ? url : undefined;
}
