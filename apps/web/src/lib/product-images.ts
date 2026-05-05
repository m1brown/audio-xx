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

  // Chord Electronics — og:image URLs from product pages (refreshed 2026-04-17)
  { key: 'chord hugo tt2',  url: 'https://chordelectronics.co.uk/wp-content/uploads/2017/01/Hugo.jpg' },
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
  { key: 'topping d70',         url: 'http://upload.toppingaudio.com/contents/2025/86/e0/iFkOZUtDRIHy85TQH1D2yWBOQDBCbUqkz6x5iJFb.webp' },
  { key: 'topping d90se',       url: 'https://upload.toppingaudio.com/contents/2025/2a/e9/l8tqlW4252nLGvNXR1LTJIwxymzkf4Q8JGOk1wHy.webp' },

  // Eversolo — eversolo.com /Uploads/product/ CDN
  { key: 'eversolo dac z8',     url: 'https://eversolo.com/Uploads/product/cc469ca22b4d35699bde1cdf245ef714.jpg' },

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
  { key: 'kef r3',              url: 'https://us.kef.com/cdn/shop/files/r3-meta_sp4053b1_product__front-side.png?v=1773978064&width=1024' },

  // Harbeth — harbeth.co.uk
  { key: 'harbeth p3esr',       url: 'https://harbeth.co.uk/wp-content/uploads/2024/11/P3ESR-XD2-cherry.png' },
  { key: 'harbeth super hl5',   url: 'https://www.harbeth.co.uk/images/SHL5plus-XD-Cherry-Front.jpg' },
  { key: 'harbeth 30',          url: 'https://www.harbeth.co.uk/images/M30.2-XD-Cherry-Front.jpg' },

  // WLM — hifi-guide.com product image
  { key: 'wlm diva',            url: 'https://www.hifi-guide.com/wp-content/uploads/2023/02/WLM-Diva-Monitor.jpg' },

  // Hornshoppe — stereophile.com product image
  { key: 'hornshoppe horn',     url: 'https://www.stereophile.com/images/archivesart/104horn1.jpg' },

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
  { key: 'klipsch la scala',    url: 'https://www.klipsch.com/medias/la-scala-al5-natural-cherry-front.jpg' },
  { key: 'klipsch heresy',      url: 'https://www.klipsch.com/medias/heresy-iv-natural-cherry-front.jpg' },
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
  { key: 'holo audio may',      url: 'https://kitsunehifi.com/cdn/shop/files/may1.jpg' },

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

  // Sonnet — sonnetaudio.com product assets
  { key: 'sonnet morpheus',     url: 'https://www.sonnetaudio.com/images/products/morpheus-front.jpg' },

  // Merason — merason.ch product assets
  { key: 'merason frerot',      url: 'https://www.merason.ch/images/frerot-front-silver.jpg' },

  // ── Remaining DACs ────────────────────────────────────

  // Auralic — us.auralic.com product assets
  { key: 'auralic vega',        url: 'https://us.auralic.com/cdn/shop/products/VEGA-S1-Front-Silver.jpg' },

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
  { key: 'rogue audio cronus magnum', url: 'https://rogueaudio.com/Images/cronusmag3.jpg' },

  // Spendor — spendoraudio.com (additional speaker)
  { key: 'spendor a1',          url: 'https://spendoraudio.com/wp-content/uploads/a1-natural-oak-front.jpg' },
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
