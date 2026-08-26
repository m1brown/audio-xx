/**
 * System class — what KIND of system this is, from market evidence only.
 *
 * A listener wants to know where their system sits before they hear a word
 * about how it sounds, and Audio XX has been unable to say. The reason was
 * good: the only route on offer was inference from brand names, which is
 * reputation laundering. The route here is different — verified prices, the
 * maker's own range, and where publications place the product.
 *
 * THE WALL, AND IT IS ABSOLUTE.
 *
 * Price licenses AMBITION. It never licenses QUALITY. "These components cost
 * what reference-level components cost" is a fact about a market; "therefore
 * they sound like it" is a claim about the world that no invoice supports, and
 * expensive equipment can be mediocre in ways cheap equipment cannot afford to
 * be. Nothing in this module may reach a sonic conclusion, and a test asserts
 * that its vocabulary contains no sonic term at all.
 *
 * WHAT KEEPS THE TOP TWO RUNGS HONEST.
 *
 * The tempting error is to read a large number and reach for the largest word.
 * `statement` and `price_no_object` therefore require something price cannot
 * supply: that the maker offers nothing materially above this product. Where a
 * maker sells a model at several times the price — Acora's VRC at $218,000
 * against the QRC-2's $37,000, dCS's Vivaldi above the Rossini — the listener
 * has bought a serious product from the middle of a serious range, and saying
 * "statement-level" would be flattery with a citation attached.
 */

export type SystemClass =
  | 'entry'
  | 'mid_market'
  | 'high_end'
  | 'reference_oriented'
  | 'statement'
  | 'price_no_object';

export const CLASS_LABEL: Record<SystemClass, string> = {
  entry: 'entry-level',
  mid_market: 'mid-market',
  high_end: 'high-end',
  reference_oriented: 'reference-oriented',
  statement: 'statement-level',
  price_no_object: 'price-no-object',
};

/** A verified price. Never a listing, never an estimate, never a guess. */
export interface PricePoint {
  productKey: string;
  productName: string;
  /** In USD. Converted figures are not admitted; quote the USD the source gave. */
  usd: number;
  /** Whether this is the current asking price or the price when new. */
  era: 'current' | 'original';
  sourceLabel: string;
  sourceUrl: string;
  /** Authorised dealer, maker, or approved publication. Classified ads are not. */
  sourceClass: 'manufacturer' | 'authorised_dealer' | 'publication';
  /** Per pair, where the product is sold that way. */
  perPair?: boolean;
}

/**
 * Where a product sits in its maker's own range.
 *
 * The half that stops price alone from reaching the top rungs.
 */
export interface RangePosition {
  productKey: string;
  position: 'flagship' | 'below_flagship' | 'sole_model' | 'unknown';
  /** Names the higher model where one exists. That naming IS the evidence. */
  detail: string;
  sourceUrl: string;
}

export interface ClassAssessment {
  klass: SystemClass;
  /** Rendered as-is. Says what it rests on and what it does not claim. */
  statement: string;
  /** Every price that contributed, for the ledger. */
  prices: PricePoint[];
  positions: RangePosition[];
  /** Why a higher class was NOT awarded. Never empty when one was withheld. */
  withheld?: string;
}

/** USD thresholds per component, on published prices. */
const BANDS: Array<{ min: number; klass: SystemClass }> = [
  { min: 15000, klass: 'reference_oriented' },
  { min: 5000, klass: 'high_end' },
  { min: 1200, klass: 'mid_market' },
  { min: 0, klass: 'entry' },
];

function bandFor(usd: number): SystemClass {
  return BANDS.find((b) => usd >= b.min)!.klass;
}

/** The median, which one very expensive box cannot drag upward. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function money(usd: number): string {
  return `$${usd.toLocaleString('en-US')}`;
}

/**
 * Classify a system from market evidence, or decline to.
 *
 * Returns undefined when fewer than half the components have a verified
 * price. A class assigned from one figure is a guess about the rest, and the
 * whole point of this module is that the classification is evidenced.
 */
export function classifySystem(
  componentCount: number,
  prices: PricePoint[],
  positions: RangePosition[] = [],
): ClassAssessment | undefined {
  if (prices.length === 0 || prices.length * 2 < componentCount) return undefined;

  const values = prices.map((p) => p.usd);
  const typical = median(values);
  let klass = bandFor(typical);

  /*
   * The gate on the top two rungs. A maker offering something materially
   * above this product is direct evidence that the listener did not buy the
   * statement piece — and it is evidence of exactly the kind price is not.
   */
  const higherExists = positions.filter((p) => p.position === 'below_flagship');
  let withheld: string | undefined;
  if (higherExists.length > 0) {
    withheld = `${CLASS_LABEL.statement} and ${CLASS_LABEL.price_no_object} are deliberately not `
      + `claimed: ${higherExists.map((p) => p.detail).join('; ')}. `
      + `A maker offering something well above a product is the plainest evidence `
      + `that it is not that maker's statement piece.`;
  }

  const total = values.reduce((a, b) => a + b, 0);
  const named = prices
    .map((p) => `${p.productName} at ${money(p.usd)}${p.perPair ? ' the pair' : ''}`)
    .join(', ')
    // The list opens a sentence, and every product name begins with "the".
    .replace(/^the /, 'The ');

  const statement =
    `On verified prices this is a ${CLASS_LABEL[klass]} system. ${named} — `
    + `${prices.length === componentCount ? 'the four together' : 'the components priced'} `
    + `come to roughly ${money(Math.round(total / 1000) * 1000)} at the prices published `
    + `for them${prices.every((p) => p.era === 'original') ? ' when new' : ''}. `
    + `That places the ambition of the system and nothing else: what these cost `
    + `establishes the company they were built to keep, not how any of them sounds, `
    + `and no conclusion about the sound of this system rests on it.`
    + (withheld ? ` ${withheld.charAt(0).toUpperCase()}${withheld.slice(1)}` : '');

  return { klass, statement, prices, positions, withheld };
}
