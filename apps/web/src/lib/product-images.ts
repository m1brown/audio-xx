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
//
// Source attribution (optional, added 2026-05-08):
//   New entries should include `source: { tier, site, credit, captured }`
//   so each image carries its own provenance. Existing entries that
//   pre-date this field continue to work — they're informally grouped
//   by the manufacturer/dealer section comments above them and can be
//   migrated incrementally when touched.

/** Where a curated product image was sourced from. */
export type ImageSourceTier =
  | 'manufacturer'        // brand's own product page / press image
  | 'authorized_dealer'   // certified retail partner
  | 'review_publication'  // editorial review site (6moons, Stereophile, Positive Feedback, etc.)
  | 'retailer';           // generic retailer (Apos, Audiophonics, Amazon, etc.)

/** Provenance metadata for one curated product image. */
export interface ImageSource {
  /** Provenance tier — used for trust/auditing, not surfaced to users. */
  tier: ImageSourceTier;
  /** Bare host where the image lives (e.g. 'bloomaudio.com'). */
  site: string;
  /** Human-readable credit line (e.g. 'Bloom Audio', 'Falcon Acoustics'). */
  credit: string;
  /** ISO date when we verified the URL renders correctly. */
  captured: string;
}

const PRODUCT_IMAGE_URLS: ReadonlyArray<{ key: string; url: string; source?: ImageSource }> = [
  // ── DACs ───────────────────────────────────────────────

  // Chord Electronics — og:image URLs from product pages (refreshed 2026-04-17)
  // Hugo TT2: verified TT2-specific manufacturer image. Must appear
  // BEFORE the more general "chord hugo" key — substring matching is
  // first-hit-wins, and "chord hugo" is a substring of "chord hugo tt2".
  { key: 'chord hugo tt2',  url: 'https://chordelectronics.co.uk/wp-content/uploads/2018/05/Chord_Hugo2TT_Top_web-900x675.jpg' },
  { key: 'chord hugo 2',    url: 'https://chordelectronics.co.uk/wp-content/uploads/2017/01/Hugo.jpg' },
  { key: 'chord hugo',      url: 'https://chordelectronics.co.uk/wp-content/uploads/2016/09/Hugo-Angle-900x675.jpg' },
  { key: 'chord qutest',    url: '/images/products/chord-qutest.jpg' },
  { key: 'chord mojo 2',    url: 'https://chordelectronics.co.uk/wp-content/uploads/2023/04/Mojo-2-4.4-2-Edited-1024x1024.png' },
  { key: 'chord mojo',      url: 'https://chordelectronics.co.uk/wp-content/uploads/2023/04/Mojo-2-4.4-2-Edited-1024x1024.png' },
  { key: 'chord dave',      url: 'https://chordelectronics.co.uk/wp-content/uploads/2016/09/Dave.jpg' },

  // Schiit — flat /images/ CDN (stable file structure for many years)
  { key: 'schiit bifrost',      url: 'https://www.schiit.com/public/upload/images/bifrost%202%20black%201920.jpg' },
  { key: 'schiit modius',       url: 'https://www.schiit.com/img/img_5100.jpg' },
  { key: 'schiit modi',         url: 'https://www.schiit.com/img/img_3680.jpg' },

  // Denafrips — product hero shots on denafrips.com
  { key: 'denafrips terminator', url: 'https://www.denafrips.com/_files/ugd/d1b21d_b5deb62d43e84d9f8ea7cbf53bab8fd5~mv2.jpg' },
  { key: 'denafrips pontus',     url: 'https://static.wixstatic.com/media/d94477_67b3d20582784f36ab923d03ffd83ecd~mv2.jpg/v1/crop/x_0,y_93,w_3250,h_1758/fill/w_1960,h_1060,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/%E6%9C%AA%E6%A0%87%E9%A2%98-1.jpg' },
  { key: 'denafrips venus ii',   url: 'https://www.audiophonics.fr/60377-large_default/denafrips-venus-ii-12th-argent.jpg',
    source: { tier: 'retailer', site: 'audiophonics.fr', credit: 'Audiophonics', captured: '2026-05-08' } },
  { key: 'denafrips ares',       url: 'https://www.denafrips.com/_files/ugd/d1b21d_2cb41c4b40ac4987aa8bbb2de1c06a3b~mv2.jpg' },
  { key: 'denafrips enyo',       url: 'https://static.wixstatic.com/media/2351c0_2a7299db962b4c6ca243bdcdbe3c71fa~mv2.jpg/v1/crop/x_3,y_29,w_1164,h_599/fill/w_1096,h_564,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/2351c0_2a7299db962b4c6ca243bdcdbe3c71fa~mv2.jpg' },

  // iFi Audio — ifi-audio.com product assets
  { key: 'ifi zen dac',         url: 'https://ifi-audio.com/wp-content/uploads/2020/02/ZEN-DAC_front_white_2000x1333.jpg' },

  // RME Audio — rme-audio.de product images
  { key: 'rme adi 2 dac',       url: 'https://www.rme-audio.de/images/products/adi-2-dac-fs/adi-2-dac-fs-front.jpg' },

  // Bluesound — bluesound.com product catalog
  { key: 'bluesound node',      url: 'https://www.bluesound.com/media/catalog/product/n/o/node_blk_front-top_1.png' },

  // WiiM — Amazon product images (manufacturer Linkplay CDN showed wrong product)
  { key: 'wiim pro plus',       url: 'https://m.media-amazon.com/images/I/51fa861331L._AC_SL1500_.jpg' },
  { key: 'wiim pro',            url: 'https://m.media-amazon.com/images/I/51ZFB75TQxL._AC_SL1500_.jpg' },

  // Lampizator — Wix static CDN (manufacturer-hosted)
  { key: 'lampizator baltic',   url: 'https://static.wixstatic.com/media/c6db56_c2f789243c0341758ce9d2ac7d360caf~mv2.jpg/v1/fill/w_1200,h_910,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/B3%20-%202.jpg' },

  // Rockna — rockna-audio.com product assets
  { key: 'rockna wavelight',    url: 'https://www.rockna-audio.com/themes/rockna/img/product/wavelight/wavelight-dac-silver.jpg' },

  // dCS — dcsaudio.com product assets
  // Key is "dcs bart k" because normalize("Bartók") strips the accented ó,
  // leaving "bart" + "k" as separate tokens. Do NOT "fix" to "bartok".
  { key: 'dcs bart k',          url: 'https://dcsaudio.com/assets/bartok-highlights-bhd-2.jpg' },

  // Gustard — gustard.com /qfy-content/uploads/ CDN
  { key: 'gustard x26 pro',    url: 'https://shenzhenaudio.com/cdn/shop/files/1-1_cec99a1e-1550-459b-b75a-565cbf322481.jpg?v=1730458884' },
  { key: 'gustard x16',        url: 'https://www.gustard.com/qfy-content/uploads/2021/10/0d3d6e7e4f0a67feaef5e67d8e5b22d4-100.webp' },
  { key: 'gustard r26',        url: 'https://www.gustard.com/qfy-content/uploads/2022/10/ae6b2c24323caabb87bd8814319e8140-100.webp' },

  // Topping — upload.toppingaudio.com CDN
  // Key ordering: more specific keys (`d90se`) MUST appear before less
  // specific keys (`d90`). Otherwise a "Topping D90SE" lookup would
  // substring-match the `topping d90` key first and ship the wrong
  // image. Same pattern as Chord Hugo TT2 → Hugo 2 → Hugo above.
  { key: 'topping d70',         url: 'http://upload.toppingaudio.com/contents/2025/86/e0/iFkOZUtDRIHy85TQH1D2yWBOQDBCbUqkz6x5iJFb.webp' },
  { key: 'topping d90se',       url: 'https://upload.toppingaudio.com/contents/2025/2a/e9/l8tqlW4252nLGvNXR1LTJIwxymzkf4Q8JGOk1wHy.webp' },
  { key: 'topping d90',         url: 'https://apos.audio/cdn/shop/products/apos-audio-topping-dac-digital-to-analog-converter-topping-d90-dac-digital-to-analog-converter-14451789955146.jpg?v=1589681598&width=1400',
    source: { tier: 'retailer', site: 'apos.audio', credit: 'Apos Audio', captured: '2026-05-08' } },

  // Eversolo — eversolo.com /Uploads/product/ CDN + bloomaudio.com (DMP-A6)
  { key: 'eversolo dac z8',     url: 'https://eversolo.com/Uploads/product/cc469ca22b4d35699bde1cdf245ef714.jpg' },
  { key: 'eversolo dmp a6',     url: 'https://bloomaudio.com/cdn/shop/files/eversolo-a6-gen2-thumb.webp?v=1737733070&width=1080',
    source: { tier: 'authorized_dealer', site: 'bloomaudio.com', credit: 'Bloom Audio', captured: '2026-05-08' } },

  // TotalDAC — totaldac.com /fichiers/ CDN
  { key: 'totaldac d1 unity',   url: 'https://www.totaldac.com/fichiers/D1-core-front.jpg' },

  // LAiV — static.wixstatic.com product image
  { key: 'laiv harmony',         url: 'https://static.wixstatic.com/media/d91e0f_0d3dac580a4249f8ada7cf54ed152ba9~mv2.png/v1/crop/x_933,y_1775,w_6381,h_2571/fill/w_1844,h_742,fp_0.50_0.50,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/IMG_3388.png' },

  // ── Amplifiers ────────────────────────────────────────

  // Hegel — hegel.com /images/products/ CDN
  { key: 'hegel h390',          url: 'https://www.hegel.com/images/products/discontinued/H390.jpg' },
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

  // Line Magnetic — line-magnetic.eu /fileadmin/ CDN (EU distributor)
  { key: 'line magnetic lm 211ia', url: 'https://www.line-magnetic.eu/fileadmin/_processed_/b/9/csm_LM-211IA_front_eb5372c116.png' },

  // Enleum — enleum.com /wp-content/uploads/ CDN
  { key: 'enleum amp 23r',      url: 'https://enleum.com/wp-content/uploads/2022/08/AMP-23R_1-scaled.jpg.webp' },

  // Benchmark — benchmarkmedia.com Shopify CDN
  { key: 'benchmark ahb2',      url: 'https://benchmarkmedia.com/cdn/shop/products/AHB2_SilverAngle.JPG' },

  // McIntosh — mcintoshlabs.com /-/media/ CDN
  { key: 'mcintosh ma252',      url: 'https://www.mcintoshlabs.com/-/media/images/mcintoshlabs/products/productimages/ma252/ma252-front.jpg' },

  // JOB (Goldmund sub-brand) — tmraudio.com Shopify CDN (dealer; no manufacturer page)
  { key: 'job integrated',      url: 'https://tmraudio.com/cdn/shop/files/56114-3__07620.1703123373.1280.1280_700x700.jpg' },

  // NAD — nadelectronics.com Shopify CDN
  { key: 'nad c 3050',          url: 'https://nadelectronics.com/cdn/shop/files/NAD-C-3050-3-4--on-black-for-web_2000x.jpg' },

  // Primare — primare.net /wp-content/uploads/ CDN
  { key: 'primare i35',         url: 'https://primare.net/wp-content/uploads/2020/02/primare-i35-prisma-modular-integrated-amplifier-and-network-player-front-black.jpg' },

  // Rotel — rotel.com /sites/default/files/ CDN
  { key: 'rotel a11',           url: 'https://www.rotel.com/sites/default/files/product/A11%20Tribute_silver.png' },

  // Kinki Studio — Wix static CDN (manufacturer-hosted)
  { key: 'kinki studio ex m1',  url: 'https://static.wixstatic.com/media/4b933e_7c6071af923a4d89b2b2d648432e2998~mv2.png/v1/fill/w_1200,h_800,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/4b933e_7c6071af923a4d89b2b2d648432e2998~mv2.png' },

  // Accuphase — accuphase.com /model/photo/ CDN
  { key: 'accuphase e 4000',    url: 'https://www.accuphase.com/model/photo/e-4000.jpg' },
  { key: 'accuphase e 280',     url: 'https://www.accuphase.com/model/photo/e-280.jpg' },

  // Rega — rega.co.uk /wp-content/uploads/ CDN
  { key: 'rega brio',           url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Brio-front.jpg' },
  { key: 'rega elex',           url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Elex-R-front.jpg' },
  { key: 'rega aethos',         url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Aethos-front.jpg' },

  // Schiit amps
  { key: 'schiit vidar',        url: 'https://www.schiit.com/img/img_2480.jpg' },
  { key: 'schiit aegir',        url: 'https://www.schiit.com/img/img_4195.jpg' },
  { key: 'schiit saga',         url: 'https://www.schiit.com/img/img_5335.jpg' },

  // PrimaLuna — primaluna.nl current Umbraco/media CDN. Previous
  // /wp-content/uploads/ paths returned 404 after the site re-launched.
  // The /media/ws1n5gzp/ asset is the canonical silver hero shot used
  // on the EVO 300 product page (3/4 angle).
  { key: 'primaluna evo 300',   url: 'https://www.primaluna.nl/media/ws1n5gzp/02_silver_quarter-updated.jpg',
    source: { tier: 'manufacturer', site: 'primaluna.nl', credit: 'PrimaLuna', captured: '2026-05-12' } },
  // EVO 400 left at legacy URL (404) — also needs manual curation; out
  // of scope for the 2026-05-12 narrow pass.
  { key: 'primaluna evo 400',   url: 'https://www.primaluna.nl/wp-content/uploads/2019/01/EVO-400-Integrated-Amplifier-Silver-Front.jpg' },

  // Leben — front-on hero from hifi.nl (Dutch HiFi review publication).
  // Updated 2026-05-13: the previous McLean's CDN shot was a top/back
  // angle that obscured the iconic VU meter and gold faceplate. The
  // hifi.nl asset is the canonical front view and explicitly tagged
  // CS600X (not the older CS600). Spaceless variants ("cs600x") cover
  // catalog names where normalize strips the slash/hyphen but does not
  // insert a space between letters and digits.
  { key: 'leben cs 600',        url: 'https://hifi.nl/gfx/20190205175617_2019-02-05_Leben600X_front_(980x457).jpg',
    source: { tier: 'review_publication', site: 'hifi.nl', credit: 'HiFi.nl', captured: '2026-05-13' } },
  { key: 'leben cs600',         url: 'https://hifi.nl/gfx/20190205175617_2019-02-05_Leben600X_front_(980x457).jpg',
    source: { tier: 'review_publication', site: 'hifi.nl', credit: 'HiFi.nl', captured: '2026-05-13' } },
  // Leben CS300 — left at legacy URL pending verification; CS300 not in
  // the narrow-pass scope.
  { key: 'leben cs 300',        url: 'https://www.leben-hifi.com/images/cs300xs-front.jpg' },
  { key: 'leben cs300',         url: 'https://www.leben-hifi.com/images/cs300xs-front.jpg' },

  // Marantz — vintage-receiver reference image (the 2220 and 2220B
  // share the same chassis; image is the canonical 2220 face).
  { key: 'marantz 2220',        url: 'https://classicreceivers.com/wp-content/uploads/2022/06/marantz-2220.jpg',
    source: { tier: 'review_publication', site: 'classicreceivers.com', credit: 'Classic Receivers', captured: '2026-05-08' } },

  // First Watt — Positive Feedback review hero (firstwatt.com only
  // hosts a generic site banner, not a SIT-3-specific shot).
  { key: 'first watt sit 3',    url: 'https://positive-feedback.com/wp-content/uploads/2018/07/43-First-Watt-SIT-3.jpg',
    source: { tier: 'review_publication', site: 'positive-feedback.com', credit: 'Positive Feedback', captured: '2026-05-08' } },

  // Shindo — Don Better Audio (authorized US Shindo dealer)
  { key: 'shindo cortese',      url: 'https://donbetteraudio.com/cdn/shop/products/IMG_2443-1024x683_1024x1024.jpg?v=1622686200',
    source: { tier: 'authorized_dealer', site: 'donbetteraudio.com', credit: 'Don Better Audio', captured: '2026-05-08' } },

  // Vinnie Rossi — Positive Feedback review (the legacy L2i collection
  // page is no longer hosted at vinnierossi.com)
  { key: 'vinnie rossi l2i',    url: 'https://positive-feedback.com/wp-content/uploads/2020/09/L2i-SE-Front-Silver-1.jpg',
    source: { tier: 'review_publication', site: 'positive-feedback.com', credit: 'Positive Feedback', captured: '2026-05-08' } },

  // ── Round 2 amplifier additions (2026-05-08) ─────────────

  // ampsandsound — manufacturer Shopify CDN
  { key: 'ampsandsound stereo 17', url: 'https://ampsandsound.com/cdn/shop/files/AXPONAampssmall-12_5000x.jpg?v=1774852440',
    source: { tier: 'manufacturer', site: 'ampsandsound.com', credit: 'ampsandsound', captured: '2026-05-08' } },

  // Linear Tube Audio — Squarespace CDN (manufacturer-hosted)
  { key: 'linear tube audio z40', url: 'https://images.squarespace-cdn.com/content/v1/551c5a82e4b0c1e6d1556b74/1574870353049-GQ3TAH3FQEXHAKIVWZH9/Z40i_004+1120x1120+crop.jpg',
    source: { tier: 'manufacturer', site: 'lineartubeaudio.com', credit: 'Linear Tube Audio', captured: '2026-05-08' } },

  // Aurorasound — highend-electronics dealer Shopify CDN
  { key: 'aurorasound hfsa 01', url: 'https://highend-electronics.com/cdn/shop/files/HFSA-01-002-1280.jpg?v=1693089381',
    source: { tier: 'authorized_dealer', site: 'highend-electronics.com', credit: 'highend-electronics', captured: '2026-05-08' } },

  // Cayin — USA Tube Audio (US Cayin distributor) S3 CDN
  { key: 'cayin a 88t mk2',     url: 'https://usatubeaudio.s3.amazonaws.com/2018/07/Cayin-A-88T-MK2--600x400.jpg',
    source: { tier: 'authorized_dealer', site: 'usatubeaudio.com', credit: 'USA Tube Audio', captured: '2026-05-08' } },
  { key: 'cayin a 88t',         url: 'https://usatubeaudio.s3.amazonaws.com/2018/07/Cayin-A-88T-MK2--600x400.jpg',
    source: { tier: 'authorized_dealer', site: 'usatubeaudio.com', credit: 'USA Tube Audio', captured: '2026-05-08' } },

  // Goldmund / JOB 225 — The Music Room dealer (no manufacturer page for the J225)
  { key: 'goldmund job 225',    url: 'https://tmraudio.com/cdn/shop/files/12146-2__49893.1519836863.1280.1280_1280x574.jpg?v=1769654961',
    source: { tier: 'authorized_dealer', site: 'tmraudio.com', credit: 'The Music Room', captured: '2026-05-08' } },
  { key: 'job 225',             url: 'https://tmraudio.com/cdn/shop/files/12146-2__49893.1519836863.1280.1280_1280x574.jpg?v=1769654961',
    source: { tier: 'authorized_dealer', site: 'tmraudio.com', credit: 'The Music Room', captured: '2026-05-08' } },

  // Crayon Audio — eliseaudio.co.uk dealer Wix CDN (hand-tuned to 900px)
  { key: 'crayon audio cia 1',  url: 'https://static.wixstatic.com/media/5e5570_6aa5f99be34645d1b56d91ae9bce1479~mv2.jpg/v1/fill/w_900,h_900,al_c,q_85/5e5570_6aa5f99be34645d1b56d91ae9bce1479~mv2.jpg',
    source: { tier: 'authorized_dealer', site: 'eliteaudiouk.com', credit: 'Elite Audio UK', captured: '2026-05-08' } },
  { key: 'crayon cia 1',        url: 'https://static.wixstatic.com/media/5e5570_6aa5f99be34645d1b56d91ae9bce1479~mv2.jpg/v1/fill/w_900,h_900,al_c,q_85/5e5570_6aa5f99be34645d1b56d91ae9bce1479~mv2.jpg',
    source: { tier: 'authorized_dealer', site: 'eliteaudiouk.com', credit: 'Elite Audio UK', captured: '2026-05-08' } },

  // Kinki Studio — manufacturer Wix CDN
  { key: 'kinki studio dazzle', url: 'https://static.wixstatic.com/media/4b933e_bb82a88a6dcc4ebe9c21686a97c8580e~mv2.png',
    source: { tier: 'manufacturer', site: 'kinki-studio.com', credit: 'Kinki Studio', captured: '2026-05-08' } },

  // Grandinote — manufacturer Wix CDN (hand-tuned to 900px)
  { key: 'grandinote shinai',   url: 'https://static.wixstatic.com/media/84cf6f_40414bc3372d4eac812277fcc9fdf99f~mv2.jpg/v1/fill/w_900,h_900,al_c,q_85/shinai7.jpg',
    source: { tier: 'manufacturer', site: 'grandinote.it', credit: 'Grandinote', captured: '2026-05-08' } },

  // Soulution — manufacturer WordPress CDN
  { key: 'soulution 330',       url: 'https://soulution-audio.com/wp-content/uploads/2018/02/soulution_330_1802_006.jpg',
    source: { tier: 'manufacturer', site: 'soulution-audio.com', credit: 'Soulution', captured: '2026-05-08' } },

  // Ayre — manufacturer WordPress CDN
  { key: 'ayre vx 5',           url: 'https://ayre.com/wp-content/uploads/2018/04/VX-5_FRONT_Web.jpg',
    source: { tier: 'manufacturer', site: 'ayre.com', credit: 'Ayre Acoustics', captured: '2026-05-08' } },

  // Bottlehead — manufacturer Shopify CDN
  { key: 'bottlehead crack',    url: 'https://bottlehead.com/cdn/shop/files/Crack_Hero.jpg?v=1775342057&width=1365',
    source: { tier: 'manufacturer', site: 'bottlehead.com', credit: 'Bottlehead', captured: '2026-05-08' } },

  // Yamamoto — Exclusive Audio (Japanese authorized dealer)
  { key: 'yamamoto a 08',       url: 'https://exclusive-audio.jp/cdn/shop/files/A-08SS-1-S.jpg?v=1721120085&width=1946',
    source: { tier: 'authorized_dealer', site: 'exclusive-audio.jp', credit: 'Exclusive Audio', captured: '2026-05-08' } },

  // Singxer — Kitsune HiFi (US Singxer distributor) Shopify CDN
  { key: 'singxer sa 90',       url: 'https://kitsunehifi.com/cdn/shop/files/sa901.jpg?v=1742920926&width=1232',
    source: { tier: 'authorized_dealer', site: 'kitsunehifi.com', credit: 'Kitsune HiFi', captured: '2026-05-08' } },

  // LinnenberG — 6moons review (linnenberg-audio.de site uses Mobirise template, no per-product image)
  { key: 'linnenberg liszt',    url: 'https://6moons.com/audioreviews/linnenberg/1.jpg',
    source: { tier: 'review_publication', site: '6moons.com', credit: '6moons', captured: '2026-05-08' } },

  // AGD Productions — manufacturer WordPress CDN (image is Gran Vivace MK IV;
  // catalog "Vivace" matches via substring — same product family).
  { key: 'agd productions vivace', url: 'https://agdproduction.com/wp-content/uploads/2026/04/gran-vivace-mk-iv-reflection-monoblock-amp-1024x683.webp',
    source: { tier: 'manufacturer', site: 'agdproduction.com', credit: 'AGD Productions', captured: '2026-05-08' } },
  { key: 'agd vivace',          url: 'https://agdproduction.com/wp-content/uploads/2026/04/gran-vivace-mk-iv-reflection-monoblock-amp-1024x683.webp',
    source: { tier: 'manufacturer', site: 'agdproduction.com', credit: 'AGD Productions', captured: '2026-05-08' } },

  // ── Speakers ──────────────────────────────────────────

  // KEF — kef.com product assets
  { key: 'kef ls50 meta',       url: 'https://www.kef.com/cdn/shop/products/LS50-Meta-Carbon-Black-Single-Front_1200x.jpg' },
  { key: 'kef ls50',            url: 'https://www.kef.com/cdn/shop/products/LS50-Meta-Carbon-Black-Single-Front_1200x.jpg' },
  { key: 'kef r3',              url: 'https://us.kef.com/cdn/shop/files/r3-meta_sp4053b1_product__front-side.png?v=1773978064&width=1024' },

  // Harbeth — harbeth.co.uk
  { key: 'harbeth p3esr',       url: 'https://harbeth.co.uk/wp-content/uploads/2024/11/P3ESR-XD2-cherry.png' },
  { key: 'harbeth super hl5',   url: 'https://www.harbeth.co.uk/images/SHL5plus-XD-Cherry-Front.jpg' },
  { key: 'harbeth 30',          url: 'https://www.harbeth.co.uk/images/M30.2-XD-Cherry-Front.jpg' },

  // WLM — hifi-guide.com product image
  { key: 'wlm diva',            url: 'https://www.hifi-guide.com/wp-content/uploads/2023/02/WLM-Diva-Monitor.jpg' },

  // Buchardt Audio — manufacturer-hosted Shopify CDN. Not in the curated
  // catalog yet; the entry exists so the unknown-product clarification
  // can surface the real product photo (via getProductImage name-only
  // lookup) instead of the generic placeholder when a user asks about
  // the A700 LE specifically.
  { key: 'buchardt a700',       url: 'https://buchardtaudio.com/cdn/shop/files/5eacfaf1-bc58-4b67-a747-6869592f8bf3_900x.jpg?v=1773302031',
    source: { tier: 'manufacturer', site: 'buchardtaudio.com', credit: 'Buchardt Audio', captured: '2026-05-19' } },

  // Hornshoppe — 6moons review (manufacturer site only hosts a tiny banner crop)
  { key: 'hornshoppe horn',     url: 'https://6moons.com/audioreviews/hornshoppe2/hero_cameohorns.jpg',
    source: { tier: 'review_publication', site: '6moons.com', credit: '6moons', captured: '2026-05-08' } },

  // XSA Labs — Stereo Times review hero (xsa-labs.com hosts multiple
  // finishes / configs without a designated single hero shot).
  { key: 'xsa labs vanguard',   url: 'https://www.stereotimes.com/utils/tinymce/uploaded/xsalabs650.jpg',
    source: { tier: 'review_publication', site: 'stereotimes.com', credit: 'Stereo Times', captured: '2026-05-08' } },
  { key: 'xsa vanguard',        url: 'https://www.stereotimes.com/utils/tinymce/uploaded/xsalabs650.jpg',
    source: { tier: 'review_publication', site: 'stereotimes.com', credit: 'Stereo Times', captured: '2026-05-08' } },

  // Falcon Acoustics — manufacturer cache CDN (2025 Limited Platinum
  // Edition in Burr Amboyna — special-edition variant, but the
  // canonical LS3/5a chassis shape is unmistakable).
  { key: 'falcon ls3 5a',       url: 'https://www.falconacoustics.co.uk/media/catalog/product/cache/c68e9bbb2d73eded5f4972f8e568886c/p/l/plat_amboyna_square_600_optimised.jpg',
    source: { tier: 'manufacturer', site: 'falconacoustics.co.uk', credit: 'Falcon Acoustics', captured: '2026-05-08' } },

  // DeVore Fidelity — devorefidelity.com
  // Keys include "fidelity" to match the catalog brand "DeVore Fidelity".
  // Shorter alias without "fidelity" kept as fallback for contexts that
  // use the abbreviated brand name. URLs verified 2026-05-19 — the
  // previous 2019/06 Orangutan-O-9x-Front.jpg paths now return 404;
  // the live product pages link to the 2021/05 crop assets used in
  // the catalog imageUrl fields below.
  { key: 'devore fidelity orangutan o 93', url: 'https://devorefidelity.com/wp-content/uploads/2021/05/O93new-682x1024.jpg',
    source: { tier: 'manufacturer', site: 'devorefidelity.com', credit: 'DeVore Fidelity', captured: '2026-05-19' } },
  { key: 'devore orangutan o 93',          url: 'https://devorefidelity.com/wp-content/uploads/2021/05/O93new-682x1024.jpg',
    source: { tier: 'manufacturer', site: 'devorefidelity.com', credit: 'DeVore Fidelity', captured: '2026-05-19' } },
  { key: 'devore fidelity orangutan o 96', url: 'https://devorefidelity.com/wp-content/uploads/2021/05/O96-new-crop-766x1024.jpg',
    source: { tier: 'manufacturer', site: 'devorefidelity.com', credit: 'DeVore Fidelity', captured: '2026-05-19' } },
  { key: 'devore orangutan o 96',          url: 'https://devorefidelity.com/wp-content/uploads/2021/05/O96-new-crop-766x1024.jpg',
    source: { tier: 'manufacturer', site: 'devorefidelity.com', credit: 'DeVore Fidelity', captured: '2026-05-19' } },

  // Magico — Squarespace CDN (manufacturer-hosted)
  { key: 'magico a3',            url: 'https://images.squarespace-cdn.com/content/v1/5d6806d4d4a70b00015c75b4/1567191992078-77SK24QU4NQ1S2MILAHZ/3+%284%29.jpg?format=2500w' },

  // Klipsch Heritage — klipsch.com /medias/ CDN
  { key: 'klipsch la scala',    url: 'https://www.klipsch.com/medias/la-scala-al5-natural-cherry-front.jpg' },
  { key: 'klipsch heresy',      url: 'https://klipsch.imgix.net/product-images/Heresy-IV_American-Walnut_Front_2024-07-09-235240_vpra.jpg',
    source: { tier: 'manufacturer', site: 'klipsch.imgix.net', credit: 'Klipsch', captured: '2026-05-12' } },
  { key: 'klipsch cornwall',    url: 'https://www.klipsch.com/medias/cornwall-iv-natural-cherry-front.jpg' },
  { key: 'klipsch forte',       url: 'https://www.klipsch.com/medias/forte-iv-natural-cherry-front.jpg' },

  // Boenicke — boenicke-audio.ch /wp-content/uploads/ CDN
  { key: 'boenicke w5',          url: 'https://boenicke-audio.ch/wp-content/uploads/2017/08/W5_halbvorne_web.jpg' },
  { key: 'boenicke w8',          url: 'https://boenicke-audio.ch/wp-content/uploads/2017/08/W8_halbseite_web.jpg' },

  // Magnepan — magnepan.com Shopify CDN
  // Key "magnepan 1 7i" must appear before "magnepan lrs" — no collision
  // but longer/more-specific keys first is the convention.
  { key: 'magnepan 1 7i',        url: 'https://magnepan.com/cdn/shop/products/Mg_1.7_White_Pair_1_1800x1800.jpg?v=1643770217' },
  // Key is "magnepan lrs" because normalize("LRS+") strips the "+".
  { key: 'magnepan lrs',         url: 'https://magnepan.com/cdn/shop/products/Speakers-3_1800x1800.jpg?v=1754334504' },

  // Focal — focal.com + Focal-Naim DAM CDN
  { key: 'focal kanta no 2',     url: 'https://dam.focal-naim.com/m/52fdcf02309f4f88/original/KantaN2_walnut-mat_Ivory_mat_34-jpg.jpg' },
  { key: 'focal aria 906',       url: 'https://www.focal.com/sites/www.focal.com/files/aria-906-walnut-front.jpg' },

  // Wharfedale — wharfedaleusa.com Shopify CDN (official US distributor)
  { key: 'wharfedale linton',    url: 'https://www.wharfedaleusa.com/cdn/shop/products/LINTONHeritageWalnut_1_1200x.jpg?v=1630422663' },

  // Bowers & Wilkins — bowerswilkins.com
  { key: 'bowers wilkins 705',  url: 'https://www.bowerswilkins.com/medias/705-s3-gloss-black-front.png' },

  // Spendor — spendoraudio.com
  { key: 'spendor d7',          url: 'https://spendoraudio.com/wp-content/uploads/d7.2-natural-oak-front.jpg' },

  // Dynaudio — dynaudio.com
  { key: 'dynaudio heritage',   url: 'https://www.dynaudio.com/media/product/heritage-special-rosewood-front.jpg' },

  // Wilson Audio — wilsonaudio.com /media/ CDN
  { key: 'wilson audio sabrina', url: 'https://www.wilsonaudio.com/media/941/sabrinax.jpg' },

  // JBL — jbl.com Demandware CDN (MkII model, visually identical to Classic)
  { key: 'jbl l100',            url: 'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw32dc552f/JBLL100MK2ORG_QtrRightWithGrille_1605x1605.png' },

  // Mission — mission.co.uk /wp-content/ CDN
  { key: 'mission 770',         url: 'https://www.mission.co.uk/wp-content/uploads/magictoolbox_cache/cf3e6ec01aac7cb79461bcfe9d0d075e/450x/660543342/770-Walnut-Standard-2.jpg' },

  // Quad — quad-hifi.co.uk Shopify CDN
  { key: 'quad va one',         url: 'https://quad-hifi.co.uk/cdn/shop/files/VA-ONE_StandardBlack_3.jpg' },

  // Goldmund — goldmund.com /wp-content/uploads/ CDN
  { key: 'goldmund telos 590',  url: 'https://goldmund.com/wp-content/uploads/2024/02/Telos-690-low-res-9.png' },

  // Electrocompaniet — electrocompaniet.com Shopify CDN
  { key: 'electrocompaniet eci 6', url: 'https://electrocompaniet.com/cdn/shop/products/ECI6-front-1000x666.jpg' },

  // darTZeel — dartzeel.com /wp-content/uploads/ CDN
  { key: 'dartzeel cth 8550',   url: 'https://dartzeel.com/wp-content/uploads/2018/03/cth-8550-front-top-left-800x5903.png' },

  // ── Turntables ────────────────────────────────────────

  // Linn — linncdn.com CDN
  { key: 'linn lp12 majik',     url: 'https://small.linncdn.com/web-media/isolated/Majik-LP12-MM_Front_Cherry.png' },

  // Technics — us.technics.com Shopify CDN
  { key: 'technics sl 1500c',   url: 'https://us.technics.com/cdn/shop/products/ShopifySL-1500C_-K__1_1800x.jpg?v=1655765762' },

  // Thorens — thorens.com /assets/media/ CDN
  { key: 'thorens td 1600',     url: 'https://www.thorens.com/en/assets/media/products/td1600/20200623-thorens-td-1600-nb-12-72.jpg' },

  // ── Headphones ────────────────────────────────────────

  // Apple — apple.com product assets
  { key: 'apple airpods pro',   url: 'https://www.apple.com/v/airpods-pro/r/images/overview/welcome/hero__b0eal3mn03ua_large.jpg' },

  // Audio-Technica — audio-technica.com /media/catalog/ CDN
  { key: 'audio technica ath m50xbt2', url: 'https://www.audio-technica.com/media/catalog/product/cache/177161fc218aa2dd413f2b73f6832b88/a/t/ath-m50xbt2_01.png' },

  // Audeze — audeze.com Shopify CDN
  { key: 'audeze lcd x',        url: 'https://www.audeze.com/cdn/shop/products/LCD-X_Updated_2019_4471x4471_600x.jpg' },

  // HiFiMAN — store.hifiman.com Magento CDN
  { key: 'hifiman susvara',     url: 'https://store.hifiman.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/s/u/susvara.jpg' },
  { key: 'hifiman arya organic', url: 'https://store.hifiman.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/a/r/arya_organic-main.jpg' },
  { key: 'hifiman ef400',       url: 'https://store.hifiman.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/1/2/1200_1200_-3.jpg' },

  // Sennheiser — sennheiser.com product assets
  { key: 'sennheiser hd 800 s', url: 'https://assets.sennheiser.com/img/hd-800-s/gallery/hd-800-s_1.jpg' },
  { key: 'sennheiser hd 600',   url: 'https://assets.sennheiser.com/img/hd-600/gallery/hd-600_1.jpg' },

  // ZMF — shop.zmfheadphones.com Shopify CDN
  { key: 'zmf verite closed',   url: 'https://shop.zmfheadphones.com/cdn/shop/files/DSC0072_1200x1200.jpg' },

  // Grado — gradolabs.com Shopify CDN
  { key: 'grado rs2x',          url: 'https://gradolabs.com/cdn/shop/products/GradoRSX2-028-Edit.jpg' },
  { key: 'grado sr80x',         url: 'https://gradolabs.com/cdn/shop/files/SR80x-side.jpg' },

  // Meze — mezeaudio.com Shopify CDN
  { key: 'meze empyrean',       url: 'https://mezeaudio.com/cdn/shop/files/Meze-Audio-Empyrean-headphone-01_4226ba5f-d514-438b-a00c-cadf82e6bbfd.webp' },

  // Dan Clark Audio — danclarkaudio.com Magento CDN
  { key: 'dan clark audio stealth', url: 'https://danclarkaudio.com/pub/media/catalog/product/cache/6517c62f5899ad6aa0ba23ceb3eeff97/s/t/stealth_1.png' },

  // KEF — us.kef.com Shopify CDN (additional models)
  { key: 'kef ls60',            url: 'https://us.kef.com/cdn/shop/files/pdt-ls60w-stn-pks-040_1200x1200.png' },

  // McIntosh — mcintoshlabs.com /-/media/ CDN (pattern from MA252)
  { key: 'mcintosh ma12000',    url: 'https://www.mcintoshlabs.com/-/media/images/mcintoshlabs/products/productimages/ma12000/ma12000-front.jpg' },

  // Hegel — hegel.com /images/products/ CDN (pattern from H390/H190)
  { key: 'hegel rost',          url: 'https://www.hegel.com/images/products/discontinued/Rost.jpg' },

  // Rega — rega.co.uk /wp-content/uploads/ CDN (turntable)
  { key: 'rega planar 3',       url: 'https://www.rega.co.uk/wp-content/uploads/2020/01/Planar-3-front.jpg' },
  // Pro-Ject — project-audio.com product assets
  { key: 'pro ject debut pro',  url: 'https://www.project-audio.com/wp-content/uploads/2020/09/Debut-PRO_1_black_o_cartridge-1536x1536.png' },

  // WiiM — wiimhome.com / Linkplay CDN (additional models)
  { key: 'wiim ultra',          url: 'https://cdn.shopify.com/s/files/1/0833/6441/3757/files/listing_1_Main_picture_Gray_2056e197-e4f8-4e39-8f41-bd792622f0a8.jpg' },
  { key: 'wiim amp',            url: 'https://cloudadmin-file.linkplay.com/product/image/b4bb2c26859e4f68b32df583307bf82e.png' },

  // Cambridge Audio — cambridgeaudio.com /sites/default/files/ CDN
  { key: 'cambridge audio cxa81', url: 'https://www.cambridgeaudio.com/sites/default/files/ecommece/product/image/Cambridge_Audio_CXA81_Front.png' },

  // Amphion — amphion.fi /wp-content/uploads/ CDN
  { key: 'amphion argon3s',     url: 'https://amphion.fi/wp-content/uploads/2022/04/Argon3s-black.png' },

  // Focal — dam.focal-naim.com CDN (headphones)
  { key: 'focal clear mg',      url: 'https://dam.focal-naim.com/m/305c17715d989c72/original/Clear_MG_34-jpg.jpg' },

  // Sony — sony.com product assets
  { key: 'sony wh 1000xm5',    url: 'https://www.sony.com/image/5d02da5df552836db894cead8a68f5f3' },
  { key: 'sony ier m7',         url: 'https://www.sony.com/image/a7b7c7f037f84ee1b17df8e57534ed70' },

  // Etymotic — etymotic.com product assets
  { key: 'etymotic er2xr',     url: 'https://www.etymotic.com/wp-content/uploads/2022/03/er2xr-earphone-front.jpg' },

  // Shure — shure.com product assets
  { key: 'shure aonic 3',      url: 'https://pubs.shure.com/guide/aonic3/images/aonic3-hero.png' },

  // Sennheiser — sennheiser.com (additional models)
  { key: 'sennheiser momentum 4', url: 'https://assets.sennheiser.com/img/momentum-4-wireless/gallery/momentum-4-wireless_1.jpg' },

  // Holo Audio — kitsunehifi.com Shopify CDN (US distributor)
  { key: 'holo audio may',          url: 'https://kitsunehifi.com/cdn/shop/files/may1.jpg' },
  { key: 'holo audio spring 3',     url: 'https://kitsunehifi.com/cdn/shop/files/2-scaled.jpg?v=1743712210&width=2560',
    source: { tier: 'authorized_dealer', site: 'kitsunehifi.com', credit: 'Kitsune HiFi', captured: '2026-05-08' } },
  { key: 'holo audio cyan 2',       url: 'https://kitsunehifi.com/cdn/shop/files/cyan-1_1c3a3843-8b1c-44f8-9c5f-df64340e856c.jpg?v=1712877064&width=1232',
    source: { tier: 'authorized_dealer', site: 'kitsunehifi.com', credit: 'Kitsune HiFi', captured: '2026-05-08' } },

  // Magnepan — magnepan.com Shopify CDN (additional model)
  { key: 'magnepan 7',          url: 'https://magnepan.com/cdn/shop/products/Mg.7_White_Pair_1_1200x1200.jpg' },

  // Audiolab — audiolab.co.uk Shopify CDN
  { key: 'audiolab 6000a',      url: 'https://www.audiolab.co.uk/cdn/shop/files/6000ABlack2048x2048jpg_1.jpg' },

  // NAD — nadelectronics.com Shopify CDN (additional model)
  { key: 'nad c 316bee',        url: 'https://nadelectronics.com/cdn/shop/files/NAD-C-316BEE-Intagrated-amplifier-Front.jpg' },

  // MHDT — mhdtlab.com product image
  { key: 'mhdt orchid',         url: 'https://www.mhdtlab.com/images/product/orchid/orchid-front.jpg' },

  // Holo Audio — kitsunehifi.com Shopify CDN (US distributor)
  { key: 'holo cyan',           url: 'https://kitsunehifi.com/cdn/shop/files/cyan2.jpg' },

  // Sonnet — sonnetaudio.com product assets + eliseaudio.com (Pasithea)
  // Note: catalog uses inconsistent brand strings — "Sonnet" for Pasithea
  // (dacs.ts:3704), "Sonnet Digital Audio" for Morpheus (dacs.ts:2365).
  // Both keys below are needed to match each catalog brand+name pair.
  { key: 'sonnet pasithea',           url: 'https://eliseaudio.com/cdn/shop/files/eliseaudiopasithea.png?v=1693561670&width=1946',
    source: { tier: 'authorized_dealer', site: 'eliseaudio.com', credit: 'Elise Audio', captured: '2026-05-08' } },
  { key: 'sonnet digital audio morpheus', url: 'https://www.sonnetaudio.com/images/products/morpheus-front.jpg' },
  { key: 'sonnet morpheus',           url: 'https://www.sonnetaudio.com/images/products/morpheus-front.jpg' },

  // Merason — Squarespace CDN (merason.ch swapped hosting; old URL stale)
  // Catalog stores "Frérot" with diacritic. The `normalize()` regex
  // strips non-ASCII letters → "fr rot", not "frerot". Both keys cover
  // the parsed and the more-readable spellings.
  { key: 'merason frerot',      url: 'https://images.squarespace-cdn.com/content/v1/694aade551fad3322e70702a/493eab22-5a4d-4b54-964f-696a3bbbd7e0/Merason_frerot_schwarz_front.jpg',
    source: { tier: 'manufacturer', site: 'merason.com', credit: 'Merason', captured: '2026-05-08' } },
  { key: 'merason fr rot',      url: 'https://images.squarespace-cdn.com/content/v1/694aade551fad3322e70702a/493eab22-5a4d-4b54-964f-696a3bbbd7e0/Merason_frerot_schwarz_front.jpg',
    source: { tier: 'manufacturer', site: 'merason.com', credit: 'Merason', captured: '2026-05-08' } },

  // ── Remaining DACs ────────────────────────────────────

  // Auralic — us.auralic.com product assets
  { key: 'auralic vega',        url: 'https://www.hifi.fr/3468-large_default/auralic-vega.jpg',
    source: { tier: 'authorized_dealer', site: 'hifi.fr', credit: 'HiFi France', captured: '2026-05-12' } },

  // SMSL — smsl-audio.com product assets
  { key: 'smsl do300',          url: 'https://www.smsl-audio.com/upload/portal/20230118/DO300-1.png' },
  { key: 'smsl su 9',           url: 'https://www.smsl-audio.com/upload/portal/20210301/SU-9-1.jpg' },

  // Weiss — weiss.ch product assets
  { key: 'weiss dac204',        url: 'https://weiss.ch/wp-content/uploads/2023/11/DAC204-front-silver.jpg' },

  // Musical Fidelity — musicalfidelity.com product assets
  { key: 'musical fidelity v90', url: 'https://musicalfidelity.com/wp-content/uploads/2020/01/V90-DAC-front.jpg' },

  // ── Remaining Amplifiers ──────────────────────────────

  // Scott — vintage tube amplifier
  { key: 'scott 222',           url: 'https://preview.redd.it/hh-scott-222b-tube-integrated-amp-estimated-value-v0-7bfwf2ps75ug1.jpeg?width=1080&crop=smart&auto=webp&s=f7b7ce228d6e0f3c42194f35c8eeaf78d8837067' },

  // Rogue Audio — rogueaudio.com
  { key: 'rogue audio cronus magnum', url: 'https://listenroom.com/cdn/shop/files/RogueAudioCronusMagnumIIIsilverfront.jpg',
    source: { tier: 'authorized_dealer', site: 'listenroom.com', credit: 'The Listening Room', captured: '2026-05-12' } },

  // Spendor — spendoraudio.com (additional speaker)
  { key: 'spendor a1',          url: 'https://spendoraudio.com/wp-content/uploads/a1-natural-oak-front.jpg' },

  // ──────────────────────────────────────────────────────
  // Round 3 additions (2026-05-08) — full coverage push
  // ──────────────────────────────────────────────────────
  // Each entry carries explicit `source` provenance. Products without
  // a verified source URL (Goldmund SRDA, Goldmund Telos 390, Zu Dirty
  // Weekend, Cube Audio Nenuphar Mini, Ocellia Calliope .21, Totem Model 1
  // Signature, Mission MS 50 8VET, Oppo OPDV971H, Linear Tube Audio Z10
  // discontinued, Trends TA-10, TotalDAC d1-twelve MK2, Campfire
  // Andromeda) intentionally remain uncurated — strict resolver returns
  // undefined and the renderer omits the image surface.

  // ── DACs ─────────────────────────────────────────────

  // Audalytic (Gustard sub-brand) — ShenzhenAudio dealer Shopify CDN
  { key: 'audalytic dr70',      url: 'https://shenzhenaudio.com/cdn/shop/files/2_6148a1d1-7f61-4c1b-936e-ddfba4739c80.png?v=1762239102&width=1946',
    source: { tier: 'authorized_dealer', site: 'shenzhenaudio.com', credit: 'Shenzhen Audio', captured: '2026-05-08' } },

  // FiiO — manufacturer CDN (Wezhan static host)
  { key: 'fiio k9 pro',         url: 'https://nwzimg.wezhan.net/contents/sitefiles3600/18000638/images/4833971.png',
    source: { tier: 'manufacturer', site: 'fiio.com', credit: 'FiiO', captured: '2026-05-08' } },
  { key: 'fiio k11 r2r',        url: 'https://nwzimg.wezhan.net/contents/sitefiles3600/18000638/images/9436560.png',
    source: { tier: 'manufacturer', site: 'fiio.com', credit: 'FiiO', captured: '2026-05-08' } },

  // Innuos — manufacturer CloudFront CDN
  { key: 'innuos zen mk3',      url: 'https://d1stdttvoxapnu.cloudfront.net/wp-content/uploads/2022/12/ZEN_intro.webp',
    source: { tier: 'manufacturer', site: 'innuos.com', credit: 'Innuos', captured: '2026-05-08' } },
  { key: 'innuos pulse mini',   url: 'https://d1stdttvoxapnu.cloudfront.net/wp-content/uploads/2023/11/PULSEmini_transparent_1080x1080_front_fascia.webp',
    source: { tier: 'manufacturer', site: 'innuos.com', credit: 'Innuos', captured: '2026-05-08' } },

  // Mola Mola — manufacturer site (mola-mola.nl)
  { key: 'mola mola tambaqui',  url: 'https://www.mola-mola.nl/img/tambaqui/Mola_Mola_studio-32.jpg',
    source: { tier: 'manufacturer', site: 'mola-mola.nl', credit: 'Mola Mola', captured: '2026-05-08' } },

  // Cen.Grand — manufacturer (cen-grand.com)
  { key: 'cen grand dsdac',     url: 'https://en.cen-grand.com/repository/image/2c07e7b2-91d2-4ef5-b5e5-a9ba9a642fec.jpg',
    source: { tier: 'manufacturer', site: 'en.cen-grand.com', credit: 'Cen.Grand', captured: '2026-05-08' } },

  // ── Amplifiers (round-2 retries) ─────────────────────

  // Goldmund Telos 690 — manufacturer (Telos 390 has no public page; Telos 690 does)
  { key: 'goldmund telos 690',  url: 'https://goldmund.com/wp-content/uploads/2024/02/Telos-690-low-res-9.png',
    source: { tier: 'manufacturer', site: 'goldmund.com', credit: 'Goldmund', captured: '2026-05-08' } },

  // ── Speakers ──────────────────────────────────────────

  // Qualio — manufacturer Shopify CDN (used full-size variant — strip the 120x120 thumbnail param)
  { key: 'qualio audio iq',     url: 'https://www.qualioaudio.com/cdn/shop/products/QualioIQBlacksatin_3.jpg?v=1669278227',
    source: { tier: 'manufacturer', site: 'qualioaudio.com', credit: 'Qualio Audio', captured: '2026-05-08' } },
  { key: 'qualio iq',           url: 'https://www.qualioaudio.com/cdn/shop/products/QualioIQBlacksatin_3.jpg?v=1669278227',
    source: { tier: 'manufacturer', site: 'qualioaudio.com', credit: 'Qualio Audio', captured: '2026-05-08' } },

  // Altec Lansing — Aural HiFi (vintage restoration specialist)
  { key: 'altec model 19',      url: 'https://auralhifi.com/cdn/shop/files/vintage-altec-lansing-model-nineteen-speakers-custom-restoration-whiteen19--01_1024x.jpg?v=1691005141',
    source: { tier: 'authorized_dealer', site: 'auralhifi.com', credit: 'Aural HiFi', captured: '2026-05-08' } },
  { key: 'altec lansing model 19', url: 'https://auralhifi.com/cdn/shop/files/vintage-altec-lansing-model-nineteen-speakers-custom-restoration-whiteen19--01_1024x.jpg?v=1691005141',
    source: { tier: 'authorized_dealer', site: 'auralhifi.com', credit: 'Aural HiFi', captured: '2026-05-08' } },

  // sound|kaos — Enleum (authorized dealer, hosts manufacturer image)
  { key: 'sound kaos vox',      url: 'https://enleum.com/wp-content/uploads/2022/09/VOX_3.jpg',
    source: { tier: 'authorized_dealer', site: 'enleum.com', credit: 'Enleum', captured: '2026-05-08' } },
  { key: 'soundkaos vox',       url: 'https://enleum.com/wp-content/uploads/2022/09/VOX_3.jpg',
    source: { tier: 'authorized_dealer', site: 'enleum.com', credit: 'Enleum', captured: '2026-05-08' } },

  // Mission — The Turntable Store (carries the M50 / MS-50)
  { key: 'mission ms 50',       url: 'https://www.theturntablestore.com/cdn/shop/files/P1030263.jpg?v=1732189515&width=1946',
    source: { tier: 'authorized_dealer', site: 'theturntablestore.com', credit: 'The Turntable Store', captured: '2026-05-08' } },
  { key: 'mission m50',         url: 'https://www.theturntablestore.com/cdn/shop/files/P1030263.jpg?v=1732189515&width=1946',
    source: { tier: 'authorized_dealer', site: 'theturntablestore.com', credit: 'The Turntable Store', captured: '2026-05-08' } },

  // ── Headphones ────────────────────────────────────────

  // Moondrop — manufacturer Webflow CDN (image-CDN proxied through moondroplab.com)
  { key: 'moondrop aria 2',     url: 'https://moondroplab.com/cdn-cgi/image/format=avif,quality=90/https://cdn.prod.website-files.com/627128d862c9a44234848dda/6540a32b1b300656259455e3_ARIA2.jpg',
    source: { tier: 'manufacturer', site: 'moondroplab.com', credit: 'Moondrop', captured: '2026-05-08' } },
  { key: 'moondrop blessing 3', url: 'https://moondroplab.com/cdn-cgi/image/format=avif,quality=90/https://cdn.prod.website-files.com/627128d862c9a44234848dda/6440b2b621093331fce44fc9_B3.jpg',
    source: { tier: 'manufacturer', site: 'moondroplab.com', credit: 'Moondrop', captured: '2026-05-08' } },

  // Campfire Audio — Headfonics review (manufacturer + retailers all 404'd)
  { key: 'campfire audio honeydew', url: 'https://headfonics.com/wp-content/uploads/2021/08/campfire-honeydew-review.jpg',
    source: { tier: 'review_publication', site: 'headfonics.com', credit: 'Headfonics', captured: '2026-05-08' } },
  // Campfire Solaris — Bloom Audio (authorized dealer)
  { key: 'campfire audio solaris',  url: 'https://bloomaudio.com/cdn/shop/files/campfire-solaris-vulcan-thumb-five.webp?v=1731519129&width=1080',
    source: { tier: 'authorized_dealer', site: 'bloomaudio.com', credit: 'Bloom Audio', captured: '2026-05-08' } },

  // RAAL-Requisite — manufacturer (raalrequisite.com)
  // Catalog brand "Raal-Requisite" + name "1995 Immanis" → normalize →
  // "raal requisite 1995 immanis" (the "1995" sits between brand and
  // name). The exact-match key plus shorter aliases cover both.
  { key: 'raal requisite 1995 immanis', url: 'https://raalrequisite.com/wp-content/uploads/2024/08/mckinney-template-hero-imannispiano-1.jpg',
    source: { tier: 'manufacturer', site: 'raalrequisite.com', credit: 'RAAL-Requisite', captured: '2026-05-08' } },
  { key: '1995 immanis',         url: 'https://raalrequisite.com/wp-content/uploads/2024/08/mckinney-template-hero-imannispiano-1.jpg',
    source: { tier: 'manufacturer', site: 'raalrequisite.com', credit: 'RAAL-Requisite', captured: '2026-05-08' } },

  // Aune — Plentymarkets (used by aune-store.com EU dealer)
  { key: 'aune ar5000',         url: 'https://cdn02.plentymarkets.com/dvw13795n3e0/item/images/110208/full/AR5000-Aune-Audio-Open-Ear-Headphone.jpg',
    source: { tier: 'authorized_dealer', site: 'aune-store.com', credit: 'Aune Store', captured: '2026-05-08' } },

  // ── Turntables ────────────────────────────────────────

  // VPI — manufacturer direct-sales site (vpidirect.com)
  { key: 'vpi cliffwood',       url: 'https://www.vpidirect.com/cdn/shop/files/cliffwood.jpg?v=1695597766&width=1946',
    source: { tier: 'manufacturer', site: 'vpidirect.com', credit: 'VPI Industries', captured: '2026-05-08' } },
];

/**
 * Resolve an image for a product by brand + name.
 *
 * Matches the curated map by normalized substring (longest/most-specific
 * key first is implicit in iteration order — we put more specific keys
 * earlier). Returns undefined when no entry matches, letting the render
 * layer cleanly omit the image block.
 *
 * Empty-URL sentinel: when an entry's `url` is the empty string `''`,
 * the function treats the key match as "intentionally uncurated" — it
 * returns `undefined` and stops iteration. This lets us register
 * specific products that we explicitly do NOT want to fall through to
 * a less-specific brand-prefix key (e.g. "chord hugo tt2" otherwise
 * substring-matches the more general "chord hugo" entry below it,
 * shipping the wrong image for TT2). Empty-URL entries are a positive
 * curation statement, not a placeholder waiting to be filled.
 */
/**
 * Resolved image entry with provenance — used when callers need to
 * render an "Image source: <site>" attribution alongside the image.
 */
export interface ResolvedProductImage {
  url: string;
  source?: ImageSource;
}

/**
 * Like `getProductImage` but also returns the entry's `source`
 * metadata so the renderer can surface attribution
 * ("Image source: buchardtaudio.com", etc.).
 *
 * Same F4 gate applies — entries with `tier === 'review_publication'`
 * are skipped. Empty-URL entries return undefined identically to the
 * URL-only function.
 */
export function getProductImageEntry(
  brand: string | undefined,
  name: string | undefined,
): ResolvedProductImage | undefined {
  const haystack = normalize(`${brand ?? ''} ${name ?? ''}`);
  if (!haystack) return undefined;
  for (const entry of PRODUCT_IMAGE_URLS) {
    if (haystack.includes(entry.key)) {
      if (entry.source?.tier === 'review_publication') continue;
      if (entry.url === '') return undefined;
      return { url: entry.url, source: entry.source };
    }
  }
  return undefined;
}

export function getProductImage(
  brand: string | undefined,
  name: string | undefined,
): string | undefined {
  const haystack = normalize(`${brand ?? ''} ${name ?? ''}`);
  if (!haystack) return undefined;
  for (const entry of PRODUCT_IMAGE_URLS) {
    if (haystack.includes(entry.key)) {
      // F4 gate (private beta, 2026-05-18):
      //   Skip entries hosted by reviewer publications. Hotlinked
      //   images and their credit fields are review-derived material
      //   and must not appear in user-visible product cards under the
      //   F4 reviewer-data exclusion rule. Match falls through to the
      //   next entry (typically a less specific match or none), which
      //   means callers fall back to the category placeholder.
      if (entry.source?.tier === 'review_publication') continue;
      // Empty string = intentionally uncurated for this key. Stop and
      // return undefined so the substring match doesn't fall through to
      // a less-specific entry that would ship the wrong product image.
      return entry.url === '' ? undefined : entry.url;
    }
  }
  return undefined;
}

// ── Brand-level fallback ────────────────────────────────
//
// Scans the existing PRODUCT_IMAGE_URLS map for any entry whose key
// starts with the normalized brand name. Returns the first match —
// no new external URLs, just reuses what's already curated.

/** @internal Cache brand→URL so repeated lookups are O(1). */
const _brandCache = new Map<string, string | undefined>();

/**
 * Return an existing product image for the same brand, if any entry
 * in PRODUCT_IMAGE_URLS matches. No new external URLs — reuses the
 * curated overlay map. Returns undefined when the brand has zero coverage.
 */
export function getBrandImage(brand: string | undefined): string | undefined {
  if (!brand) return undefined;
  const key = normalize(brand);
  if (!key) return undefined;
  if (_brandCache.has(key)) return _brandCache.get(key);
  for (const entry of PRODUCT_IMAGE_URLS) {
    if (entry.key.startsWith(key)) {
      // F4 gate: skip review_publication-hosted images (see getProductImage).
      if (entry.source?.tier === 'review_publication') continue;
      _brandCache.set(key, entry.url);
      return entry.url;
    }
  }
  _brandCache.set(key, undefined);
  return undefined;
}

// ── Category placeholders ──────────────────────────────
//
// Static local SVGs in /public/images/placeholders/.
// Served by Next.js from the public directory — no external fetch.

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  dac:             '/images/placeholders/dac.svg',
  amplifier:       '/images/placeholders/amplifier.svg',
  integrated:      '/images/placeholders/amplifier.svg',
  preamp:          '/images/placeholders/amplifier.svg',
  'power-amp':     '/images/placeholders/amplifier.svg',
  speaker:         '/images/placeholders/speaker.svg',
  turntable:       '/images/placeholders/turntable.svg',
  phono:           '/images/placeholders/turntable.svg',
  headphone:       '/images/placeholders/headphone.svg',
  iem:             '/images/placeholders/headphone.svg',
};

const DEFAULT_PLACEHOLDER = '/images/placeholders/product.svg';

// ── Canonical image resolver (2026-05-11) ──────────────
//
// Single entry point that consumers should prefer over the raw
// `getProductImage` / `getBrandImage` helpers. The resolver returns:
//   - the chosen URL (always a string — never undefined)
//   - the confidence tag for that URL
//   - the source path that produced it
//
// Substitution policy (per image-coverage pass spec):
//   1. Catalog `imageUrl` wins.
//      Confidence comes from the catalog (`imageConfidence`); fallback
//      is 'medium' when `imageVerified` is true, else 'low'. Catalog
//      URLs are not silently swapped for a different product — if the
//      curator put a URL there, the resolver respects it.
//   2. Curated overlay map (`getProductImage`) supplies a 'medium'
//      image when the catalog has none. These are hand-keyed to the
//      product line so they are not cross-product substitutions.
//   3. Otherwise the category placeholder renders. Brand-family
//      fallback (`getBrandImage`) is intentionally NOT used here — the
//      task's "never silently substitute a clearly different product"
//      rule treats sibling-product images as substitution. The helper
//      remains available for explicit opt-in only.
//
// The returned URL is always renderable; consumers do not need to
// check for empty strings or null. Cards always have visual weight.

export type ImageConfidence = 'high' | 'medium' | 'low' | 'placeholder';

export type ImageSourcePath =
  | 'catalog-verified'
  | 'catalog'
  | 'overlay'
  | 'placeholder';

export interface ResolvedImage {
  /** A renderable URL (catalog/overlay/placeholder). Never undefined. */
  readonly url: string;
  readonly confidence: ImageConfidence;
  readonly source: ImageSourcePath;
}

/** Pick the right category placeholder for a product's catalog `category`. */
function placeholderForCategory(category: string | undefined): string {
  if (!category) return DEFAULT_PLACEHOLDER;
  const c = category.toLowerCase();
  return CATEGORY_PLACEHOLDERS[c] ?? DEFAULT_PLACEHOLDER;
}

/**
 * Image resolver with confidence metadata. Always returns a renderable
 * URL plus a confidence tag and source path. Consumers should pass the
 * catalog `imageUrl`, the brand+name (for overlay lookup), the category
 * (for placeholder selection), and the optional `imageVerified` flag.
 *
 * Renamed 2026-05-11 to avoid collision with the legacy
 * `resolveProductImage` (string-returning, brand-fallback) defined
 * further down this file. The legacy resolver is retained for callers
 * that rely on its specific chain; new callers wanting confidence
 * metadata should use this function.
 *
 * When `catalogUrl` is present the resolver honours it — it does not
 * second-guess a curator's choice. Confidence reflects whether the
 * curator has marked it verified.
 */
export function resolveProductImageWithConfidence(args: {
  catalogUrl?: string;
  catalogConfidence?: ImageConfidence;
  catalogVerified?: boolean;
  brand?: string;
  name?: string;
  category?: string;
}): ResolvedImage {
  const {
    catalogUrl,
    catalogConfidence,
    catalogVerified,
    brand,
    name,
    category,
  } = args;

  // 1. Catalog `imageUrl` — curator's explicit choice. Honor it.
  if (catalogUrl && catalogUrl.length > 0) {
    const confidence: ImageConfidence =
      catalogConfidence
      ?? (catalogVerified ? 'high' : 'medium');
    return {
      url: catalogUrl,
      confidence,
      source: catalogVerified ? 'catalog-verified' : 'catalog',
    };
  }

  // 2. Overlay map — hand-keyed (brand + name substring).
  const overlay = getProductImage(brand, name);
  if (overlay) {
    return { url: overlay, confidence: 'medium', source: 'overlay' };
  }

  // 3. Category placeholder — last-resort visual weight. No silent
  //    cross-product substitution.
  return {
    url: placeholderForCategory(category),
    confidence: 'placeholder',
    source: 'placeholder',
  };
}

/**
 * Return a static local placeholder image path for the given product category.
 * Falls back to a generic product silhouette when the category is unknown.
 */
export function getGenericPlaceholder(category?: string): string {
  if (!category) return DEFAULT_PLACEHOLDER;
  return CATEGORY_PLACEHOLDERS[category.toLowerCase()] ?? DEFAULT_PLACEHOLDER;
}

/**
 * Full image resolution chain for product cards:
 *   1. product.imageUrl (catalog field)
 *   2. getProductImage(brand, name) (curated overlay map)
 *   3. getBrandImage(brand) (first existing entry for same brand)
 *   4. getGenericPlaceholder(category) (static local SVG)
 *
 * Always returns a string — no card should ever render without an image.
 *
 * Legacy chain. Retained for callers that genuinely benefit from a
 * placeholder (e.g. brand-vs-brand comparison anchors in
 * `consultation.ts` where the placeholder grounds the UI when neither
 * side has a curated product image). New callers should prefer
 * `resolveProductImageStrict` — most product/recommendation surfaces
 * read better with the image cleanly omitted than with a generic SVG.
 */
export function resolveProductImage(
  brand: string | undefined,
  name: string | undefined,
  catalogImageUrl?: string,
  category?: string,
): string {
  return (
    catalogImageUrl
    ?? getProductImage(brand, name)
    ?? getBrandImage(brand)
    ?? getGenericPlaceholder(category)
  );
}

/**
 * Strict image resolution — returns ONLY a real, product-specific URL,
 * or `undefined` when no curated image exists for THIS product. Used by
 * recommendation, comparison, and upgrade-path surfaces where shipping
 * the wrong product's image (brand fallback) or a generic category SVG
 * (placeholder) is worse than gracefully omitting the image block.
 *
 * Chain:
 *   1. catalogImageUrl (product.imageUrl from the catalog)
 *   2. getProductImage(brand, name) (curated overlay map — substring
 *      key match against normalized brand+name)
 *   3. undefined  ← does NOT fall through to brand-image or placeholder
 *
 * Renderer contract: callers downstream (the comparison artifact's
 * `hasImages` gate, `EditorialProductSection`'s image block, etc.)
 * already handle `undefined` by omitting the image surface.
 *
 * Domain-agnostic: no audio vocabulary. The function is a key-based
 * lookup that would work unchanged in any product-card domain.
 */
export function resolveProductImageStrict(
  brand: string | undefined,
  name: string | undefined,
  catalogImageUrl?: string,
): string | undefined {
  return catalogImageUrl ?? getProductImage(brand, name);
}
