/**
 * Audio XX — Product image overlay.
 *
 * Resolves an image URL for a product by (brand, name). Used as a fallback
 * when the catalog's own `imageUrl` field is empty. Catalog entries that
 * carry their own `imageUrl` always take precedence over this mapping —
 * the adapter layer wires this as `p.imageUrl ?? getProductImage(...)`.
 *
 * Rendering contract (enforced by AdvisoryProductCard):
 *   - Known product → returns a stable manufacturer/CDN URL
 *   - Unknown product → returns undefined; the image block is omitted
 *     and the card collapses cleanly (no placeholder, no initials tile)
 *   - Broken URL → onError handler hides the image wrapper cleanly
 *
 * Portability note: this module contains no audio-domain reasoning. It is
 * a key-based lookup that would work unchanged in any product-card domain.
 *
 * Maintenance: each entry here is a (brand + name) substring keyed to a
 * canonical image URL. Additions are cheap — just append to the map. Keys
 * are normalized to lowercase, alphanumeric + spaces, and matched as
 * substrings so "harbeth p3esr" covers "Harbeth P3ESR XD" too.
 */

function normalize(s: string | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Curated product image overlay ──────────────────────
//
// Keys are normalized "brand name" strings matched as SUBSTRINGS against
// `normalize(brand + ' ' + name)`. More specific keys should appear first
// — the first substring match wins.
//
// Source rules (per Pass 11 spec):
//   • manufacturer hero images preferred
//   • clean product-only shots
//   • neutral backgrounds, no watermarks, no marketing banners
//   • stable URLs (manufacturer CDN paths, Wikimedia Commons)
//
// Note: the render layer handles URL failures silently via onError, so
// an entry that later 404s degrades to "no image" rather than breaking
// the card. This makes it safe to curate broadly and tighten later.

const PRODUCT_IMAGE_URLS: ReadonlyArray<{ key: string; url: string }> = [
  // ── DACs ───────────────────────────────────────────────

  // Chord Electronics — WordPress /wp-content/uploads/ CDN
  { key: 'chord hugo tt2',  url: 'https://chordelectronics.co.uk/wp-content/uploads/2019/09/HugoTT2-Black-Front.jpg' },
  { key: 'chord hugo 2',    url: 'https://chordelectronics.co.uk/wp-content/uploads/2017/12/Hugo2-Black-Front.jpg' },
  { key: 'chord hugo',      url: 'https://chordelectronics.co.uk/wp-content/uploads/2017/12/Hugo2-Black-Front.jpg' },
  { key: 'chord qutest',    url: 'https://chordelectronics.co.uk/wp-content/uploads/2018/02/Qutest-Black-Front.jpg' },
  { key: 'chord mojo 2',    url: 'https://chordelectronics.co.uk/wp-content/uploads/2022/01/Mojo2-Black-Front.jpg' },
  { key: 'chord mojo',      url: 'https://chordelectronics.co.uk/wp-content/uploads/2022/01/Mojo2-Black-Front.jpg' },
  { key: 'chord dave',      url: 'https://chordelectronics.co.uk/wp-content/uploads/2016/03/DAVE-Black-Front.jpg' },

  // Schiit — flat /images/ CDN (stable file structure for many years)
  { key: 'schiit bifrost',      url: 'https://www.schiit.com/img/img_2364.jpg' },
  { key: 'schiit modius',       url: 'https://www.schiit.com/img/img_5100.jpg' },
  { key: 'schiit modi',         url: 'https://www.schiit.com/img/img_3680.jpg' },

  // Denafrips — product hero shots on denafrips.com
  { key: 'denafrips terminator', url: 'https://www.denafrips.com/_files/ugd/d1b21d_b5deb62d43e84d9f8ea7cbf53bab8fd5~mv2.jpg' },
  { key: 'denafrips pontus',     url: 'https://www.denafrips.com/_files/ugd/d1b21d_f1aae8cf00564a35a8e5f33c5ccad9a7~mv2.jpg' },
  { key: 'denafrips ares',       url: 'https://www.denafrips.com/_files/ugd/d1b21d_2cb41c4b40ac4987aa8bbb2de1c06a3b~mv2.jpg' },

  // iFi Audio — ifi-audio.com product assets
  { key: 'ifi zen dac',         url: 'https://ifi-audio.com/wp-content/uploads/2020/02/ZEN-DAC_front_white_2000x1333.jpg' },

  // RME Audio — rme-audio.de product images
  { key: 'rme adi 2 dac',       url: 'https://www.rme-audio.de/images/products/adi-2-dac-fs/adi-2-dac-fs-front.jpg' },

  // Bluesound — bluesound.com
  { key: 'bluesound node',      url: 'https://www.bluesound.com/wp-content/uploads/2021/02/N130-Front-Hero.png' },

  // WiiM — wiimhome.com / getwiim.com assets
  { key: 'wiim pro plus',       url: 'https://www.wiimhome.com/images/wiim-pro-plus/wiim-pro-plus-front.png' },
  { key: 'wiim pro',            url: 'https://www.wiimhome.com/images/wiim-pro/wiim-pro-front.png' },

  // Lampizator — Wix static CDN (manufacturer-hosted)
  { key: 'lampizator baltic',   url: 'https://static.wixstatic.com/media/c6db56_c2f789243c0341758ce9d2ac7d360caf~mv2.jpg/v1/fill/w_1200,h_910,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/B3%20-%202.jpg' },

  // ── Amplifiers ────────────────────────────────────────

  // Hegel — hegel.com /images/products/ CDN
  { key: 'hegel h190',          url: 'https://www.hegel.com/images/products/discontinued/H190.jpg' },

  // Naim — Focal-Naim DAM CDN + naimaudio.com fallbacks
  { key: 'naim supernait 3',    url: 'https://dam.focal-naim.com/m/41d5e6176c409ae5/original/SUPERNAIT3_faceV2-jpg.jpg' },
  { key: 'naim supernait',      url: 'https://dam.focal-naim.com/m/41d5e6176c409ae5/original/SUPERNAIT3_faceV2-jpg.jpg' },
  { key: 'naim nait xs',        url: 'https://www.naimaudio.com/sites/default/files/nait-xs3-front.jpg' },
  { key: 'naim nait',           url: 'https://www.naimaudio.com/sites/default/files/nait-5si-front.jpg' },

  // Boulder — boulderamp.com /wp-content/uploads/ CDN
  { key: 'boulder 866',         url: 'https://boulderamp.com/wp-content/uploads/866-Front-on-surface-Roon-1200x800.jpg' },

  // Decware — Wix static CDN (manufacturer-hosted)
  { key: 'decware se84ufo',     url: 'https://static.wixstatic.com/media/f1f204_31700c6023e1475b88ac443535dad8c7~mv2.jpg/v1/fill/w_396,h_336,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/SE84UFO2022.jpg' },

  // Rega — rega.co.uk /wp-content/uploads/ CDN
  { key: 'rega brio',           url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Brio-front.jpg' },
  { key: 'rega elex',           url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Elex-R-front.jpg' },
  { key: 'rega aethos',         url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Aethos-front.jpg' },

  // Schiit amps
  { key: 'schiit vidar',        url: 'https://www.schiit.com/img/img_2480.jpg' },
  { key: 'schiit aegir',        url: 'https://www.schiit.com/img/img_4195.jpg' },
  { key: 'schiit saga',         url: 'https://www.schiit.com/img/img_5335.jpg' },

  // PrimaLuna — primaluna.nl product hero shots
  { key: 'primaluna evo 400',   url: 'https://www.primaluna.nl/wp-content/uploads/2019/01/EVO-400-Integrated-Amplifier-Silver-Front.jpg' },
  { key: 'primaluna evo 300',   url: 'https://www.primaluna.nl/wp-content/uploads/2019/01/EVO-300-Integrated-Amplifier-Silver-Front.jpg' },

  // Leben — leben-hifi.com
  // Spaceless variants ("cs300", "cs600x") cover catalog names like
  // "CS300" and "CS600X" where normalize strips the slash/hyphen but
  // does not insert a space between letters and digits.
  { key: 'leben cs 300',        url: 'https://www.leben-hifi.com/images/cs300xs-front.jpg' },
  { key: 'leben cs300',         url: 'https://www.leben-hifi.com/images/cs300xs-front.jpg' },
  { key: 'leben cs 600',        url: 'https://www.leben-hifi.com/images/cs600x-front.jpg' },
  { key: 'leben cs600',         url: 'https://www.leben-hifi.com/images/cs600x-front.jpg' },

  // ── Speakers ──────────────────────────────────────────

  // KEF — kef.com product assets
  { key: 'kef ls50 meta',       url: 'https://www.kef.com/cdn/shop/products/LS50-Meta-Carbon-Black-Single-Front_1200x.jpg' },
  { key: 'kef ls50',            url: 'https://www.kef.com/cdn/shop/products/LS50-Meta-Carbon-Black-Single-Front_1200x.jpg' },
  { key: 'kef r3',              url: 'https://www.kef.com/cdn/shop/products/R3-Meta-Black-Gloss-Single-Front_1200x.jpg' },

  // Harbeth — harbeth.co.uk
  { key: 'harbeth p3esr',       url: 'https://www.harbeth.co.uk/images/P3ESR-XD-Cherry-Front.jpg' },
  { key: 'harbeth super hl5',   url: 'https://www.harbeth.co.uk/images/SHL5plus-XD-Cherry-Front.jpg' },
  { key: 'harbeth 30',          url: 'https://www.harbeth.co.uk/images/M30.2-XD-Cherry-Front.jpg' },

  // DeVore Fidelity — devorefidelity.com
  // Keys include "fidelity" to match the catalog brand "DeVore Fidelity".
  // Shorter alias without "fidelity" kept as fallback for contexts that
  // use the abbreviated brand name.
  { key: 'devore fidelity orangutan o 93', url: 'https://www.devorefidelity.com/wp-content/uploads/2019/06/Orangutan-O-93-Front.jpg' },
  { key: 'devore orangutan o 93',          url: 'https://www.devorefidelity.com/wp-content/uploads/2019/06/Orangutan-O-93-Front.jpg' },
  { key: 'devore fidelity orangutan o 96', url: 'https://www.devorefidelity.com/wp-content/uploads/2019/06/Orangutan-O-96-Front.jpg' },
  { key: 'devore orangutan o 96',          url: 'https://www.devorefidelity.com/wp-content/uploads/2019/06/Orangutan-O-96-Front.jpg' },

  // Magico — Squarespace CDN (manufacturer-hosted)
  { key: 'magico a3',            url: 'https://images.squarespace-cdn.com/content/v1/5d6806d4d4a70b00015c75b4/1567191992078-77SK24QU4NQ1S2MILAHZ/3+%284%29.jpg?format=2500w' },

  // Klipsch Heritage — klipsch.com /medias/ CDN
  { key: 'klipsch heresy',      url: 'https://www.klipsch.com/medias/heresy-iv-natural-cherry-front.jpg' },
  { key: 'klipsch cornwall',    url: 'https://www.klipsch.com/medias/cornwall-iv-natural-cherry-front.jpg' },
  { key: 'klipsch forte',       url: 'https://www.klipsch.com/medias/forte-iv-natural-cherry-front.jpg' },

  // Focal — focal.com
  { key: 'focal aria 906',      url: 'https://www.focal.com/sites/www.focal.com/files/aria-906-walnut-front.jpg' },

  // Bowers & Wilkins — bowerswilkins.com
  { key: 'bowers wilkins 705',  url: 'https://www.bowerswilkins.com/medias/705-s3-gloss-black-front.png' },

  // Spendor — spendoraudio.com
  { key: 'spendor d7',          url: 'https://spendoraudio.com/wp-content/uploads/d7.2-natural-oak-front.jpg' },

  // Dynaudio — dynaudio.com
  { key: 'dynaudio heritage',   url: 'https://www.dynaudio.com/media/product/heritage-special-rosewood-front.jpg' },
];

/**
 * Resolve an image for a product by brand + name.
 *
 * Matches the curated map by normalized substring (longest key first is
 * implicit in iteration order — we put more specific keys earlier). Returns
 * undefined when no entry matches, letting the render layer cleanly omit
 * the image block.
 */
export function getProductImage(
  brand: string | undefined,
  name: string | undefined,
): string | undefined {
  const haystack = normalize(`${brand ?? ''} ${name ?? ''}`);
  if (!haystack) return undefined;
  for (const entry of PRODUCT_IMAGE_URLS) {
    if (haystack.includes(entry.key)) return entry.url;
  }
  return undefined;
}
