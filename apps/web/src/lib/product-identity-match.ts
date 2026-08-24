/**
 * When may a typed name resolve to a CATALOG product?
 *
 * The catalog lookup accepted `pName.startsWith(lower)`, so a listener who
 * typed "Leben CS600" was resolved to the **CS600X** — a different amplifier —
 * because one name is a prefix of the other. The same rule would resolve
 * "Reference 5" to the "Reference 5 SE".
 *
 * This is the identity defect the image layer already fixed, one layer up and
 * with higher stakes: an image is recognition, but a catalog resolution decides
 * which product's SPECIFICATIONS the assessment reasons from. Resolving CS600
 * to CS600X does not show the wrong photograph — it reasons from the wrong
 * amplifier.
 *
 * The rule is not "never match partially". Partial matching does real work:
 * "o/96" should reach "Orangutan O/96", and "hornshoppe horn" should reach
 * "Hornshoppe Horns". What must never happen is a partial match that CROSSES A
 * VARIANT BOUNDARY — where the text the match left behind is precisely what
 * distinguishes two products.
 */

/**
 * Tokens that distinguish one product from its sibling rather than describing
 * a family. If the remainder of a partial match is one of these, the match
 * has crossed from a product to a different product.
 */
const VARIANT_REMAINDER = new Set([
  'x', 'se', 'ii', 'iii', 'iv', 'v', 'vi', 'mk', 'mkii', 'mkiii', 'mkiv',
  'plus', 'apex', 'signature', 'sig', 'anniversary', 'ltd', 'limited',
  'gen', 'pro', 'max', 'mini', 'master', 'edition', 'r2r', 'dsd',
  '2', '3', '4', '5', 'w', 'wireless', 'meta', 'xd', 'tt', 'tt2',
]);

const tok = (v: string) =>
  v.toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, ' ')
    .trim().split(' ').filter(Boolean);

/**
 * Is what the partial match left over a variant marker?
 *
 * Attached remainders count too: "cs600" against "cs600x" leaves "x" with no
 * separator at all, which is the tightest possible variant marker.
 */
export function remainderIsVariant(remainder: string): boolean {
  const r = remainder.trim();
  if (r === '') return false;
  const tokens = tok(r);
  if (tokens.length === 0) return false;
  // A short trailing fragment glued to the model ("CS600" → "CS600X").
  if (tokens.length === 1 && r.length <= 4) return true;
  return tokens.every((t) => VARIANT_REMAINDER.has(t));
}

/**
 * A prefix match that does not cross a variant boundary.
 *
 * `"leben cs600"` must NOT reach `"CS600X"`; `"chord hugo"` must not reach
 * `"Hugo TT2"`. Both are rejected because the remainder is a variant marker.
 */
export function prefixMatchIsSafe(typed: string, productName: string): boolean {
  if (typed.length < 3) return false;
  if (!productName.startsWith(typed)) return false;
  return !remainderIsVariant(productName.slice(typed.length));
}

/**
 * A suffix match that does not cross a variant boundary.
 *
 * `"o/96"` reaching `"Orangutan O/96"` is a family word in front of a model —
 * legitimate. A leading remainder that is itself a variant marker is not.
 */
export function suffixMatchIsSafe(typed: string, productName: string): boolean {
  if (typed.length < 3) return false;
  if (!productName.endsWith(typed)) return false;
  return !remainderIsVariant(productName.slice(0, productName.length - typed.length));
}
