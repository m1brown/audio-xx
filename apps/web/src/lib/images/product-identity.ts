/**
 * Exact product identity for imagery.
 *
 * THE DEFECT THIS FIXES. Image lookup matched by SUBSTRING:
 * `normalize("brand name").includes(entry.key)`. So the key `leben cs600`
 * matched the product Leben CS600X, and a photograph of one generation would
 * be served for another. The registry's own comments admit the hazard —
 * "`chord hugo` is a substring of `chord hugo tt2`" — and rely on ordering the
 * table carefully, which is a convention rather than a guarantee.
 *
 * An image is an identity asset. Showing the wrong generation is worse than
 * showing nothing, because a reader takes a photograph as confirmation that
 * Audio XX knows which product they own.
 *
 * THE RULE, matching the discipline already used for review admission:
 *
 *   brand may be omitted where identity is otherwise established;
 *   model must match exactly;
 *   generation and variant tokens must match exactly;
 *   ambiguous identity yields no image.
 *
 * Comparison is over token MULTISETS, so CS600 and CS600X are different
 * products, Reference 5 and Reference 5 SE are different products, and DMP-A6
 * and DMP-A6 Gen 2 are different products. Nothing is a prefix of anything.
 */

/**
 * Lowercase alphanumeric tokens. `DMP-A6` becomes ['dmp','a6'].
 *
 * Variant-significant symbols are preserved as words rather than stripped.
 * `LRS+` and `LRS` are different loudspeakers, and discarding the plus made
 * them the same token — the identity collision this module exists to prevent,
 * reintroduced by the normaliser itself.
 */
export function identityTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = (xs: string[]) => [...xs].sort().join(' ');
  return sorted(a) === sorted(b);
}

/**
 * Does a registry key name exactly this product?
 *
 * Two accepted forms: the key carries the brand, or the key omits it. Nothing
 * else — a key that is merely a prefix, suffix or subset of the product name
 * is a DIFFERENT product until proven otherwise, and proving otherwise is what
 * a separate entry is for.
 */
export function keyNamesProduct(
  key: string,
  product: { brand?: string; name?: string },
): boolean {
  const keyTokens = identityTokens(key);
  if (keyTokens.length === 0) return false;

  const brandTokens = identityTokens(product.brand ?? '');
  const nameTokens = identityTokens(product.name ?? '');
  if (nameTokens.length === 0) return false;

  // "JOB JOB 225" — a brand repeated inside its own model name is one mention.
  const repeatsBrand = brandTokens.length > 0
    && nameTokens.length >= brandTokens.length
    && brandTokens.every((t, i) => nameTokens[i] === t);
  const full = repeatsBrand ? nameTokens : [...brandTokens, ...nameTokens];

  return sameMultiset(keyTokens, full) || sameMultiset(keyTokens, nameTokens);
}

/** Are these two references to the same exact product? */
export function sameProductIdentity(
  a: { brand?: string; name?: string },
  b: { brand?: string; name?: string },
): boolean {
  return keyNamesProduct(`${a.brand ?? ''} ${a.name ?? ''}`, b);
}
