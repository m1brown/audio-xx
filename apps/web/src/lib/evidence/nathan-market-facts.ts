/**
 * Market evidence for the Nathan reference system.
 *
 * Prices verified 2026-08-26 from authorised dealers, makers and approved
 * publications. Classified-ad asking prices are deliberately absent: what a
 * used unit fetches this week is a fact about a market in motion, not about
 * where the product was positioned.
 *
 * The Audio Research Reference 5's original price is NOT recorded. Searches
 * returned it repeatedly at $12,000, but every instance traced back to
 * secondary summaries rather than to Audio Research, an authorised dealer or
 * a review stating it, and the surrounding results were dominated by the SE
 * variant. An unverified figure is worth less than a missing one, and the
 * classification is defensible on the three that ARE verified.
 */
import type { PricePoint, RangePosition } from './system-class';

export const NATHAN_PRICES: PricePoint[] = [
  {
    productKey: 'dcs rossini apex', productName: 'the dCS Rossini Apex DAC',
    usd: 34500, era: 'current',
    sourceLabel: 'Moon Audio (authorised dCS dealer)',
    sourceUrl: 'https://www.moon-audio.com/products/rossini-apex-dac-network-streamer',
    sourceClass: 'authorised_dealer',
  },
  {
    productKey: 'acora qrc-2', productName: 'the Acora QRC-2',
    usd: 37000, era: 'current', perPair: true,
    sourceLabel: 'SoundStage!',
    sourceUrl: 'https://www.soundstageultra.com/index.php/'
      + 'equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker',
    sourceClass: 'publication',
  },
  {
    productKey: 'butler monad a100', productName: 'the Butler MONAD A100',
    usd: 19000, era: 'current', perPair: true,
    sourceLabel: 'The Audio Beatnik',
    sourceUrl: 'https://theaudiobeatnik.com/'
      + 'review-part-1-butler-a100-monoblocks-a-little-history-and-design/',
    sourceClass: 'publication',
  },
];

/**
 * Range position — the half that keeps price from reaching for the top word.
 *
 * Two of the three priced components sit below a materially more expensive
 * model from the same maker, and naming those models is the evidence.
 */
export const NATHAN_POSITIONS: RangePosition[] = [
  {
    productKey: 'acora qrc-2', position: 'below_flagship',
    detail: 'Acora places the QRC-2 in the middle of its range, below the VRC at '
      + 'US$218,000 the pair',
    sourceUrl: 'https://www.soundstageultra.com/index.php/'
      + 'equipment-menu/1284-acora-acoustics-mrc-2-loudspeaker',
  },
  {
    productKey: 'dcs rossini apex', position: 'below_flagship',
    detail: 'dCS positions Rossini below Vivaldi, and Stereophile’s review frames the '
      + 'Apex upgrade as bringing Rossini nearer Vivaldi rather than level with it',
    sourceUrl: 'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-page-2',
  },
  {
    productKey: 'butler monad a100', position: 'sole_model',
    detail: 'the A100 is the only Monad Butler offers',
    sourceUrl: 'https://butleraudio.com/esoteric.php',
  },
];
