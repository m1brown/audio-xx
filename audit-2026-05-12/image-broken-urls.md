# Verified-broken image URLs (manual review queue)

Captured 2026-05-12 during Srajan-blocker cleanup pass. Each URL below is
currently in `apps/web/src/lib/product-images.ts` but returns 404 or is
unreachable. The Strict resolver returns undefined for these, and the
ProductImage component falls back to a category SVG placeholder — so the
UI does not break, but the product looks generic.

Replacing each requires finding a stable manufacturer / authorized-dealer
CDN URL; the dead URLs below should NOT be substituted with any image
unless the new URL is verified to load the correct product.

| Key | Status | Notes |
| --- | --- | --- |
| `primaluna evo 300` → `primaluna.nl/.../EVO-300-Integrated-Amplifier-Silver-Front.jpg` | 404 | Primaluna.nl renamed asset path. Check upscaleaudio.com or kevro.com (US distributor) for a stable URL. |
| `primaluna evo 400` → `primaluna.nl/.../EVO-400-...` | likely 404 | Same root cause. Check together with EVO 300. |
| `leben cs 600` / `leben cs600` → `leben-hifi.com/images/cs600x-front.jpg` | unreachable (000) | leben-hifi.com host blocks SSL or returns no response. Try mantra-audio.com, audionote.cz, or songaudio.com (US Leben dealers). |
| `leben cs 300` / `leben cs300` → `leben-hifi.com/images/cs300xs-front.jpg` | unreachable (000) | Same as CS600. |
| `klipsch heresy` → `klipsch.com/medias/heresy-iv-natural-cherry-front.jpg` | 404 | klipsch.com restructured assets. Try `klipsch.com/dw/image/v2/...` (Demandware-style) or pull from amazon.com listings. |
| `auralic vega` → `us.auralic.com/cdn/shop/products/VEGA-S1-Front-Silver.jpg` | unreachable (000) | us.auralic.com offline. Try auralic.com (no us subdomain) or audioadvisor.com. |
| `rogue audio cronus magnum` → `rogueaudio.com/Images/cronusmag3.jpg` | 404 | rogueaudio.com asset moved. Try musicdirect.com or tmraudio.com. |

# Coverage gaps without any catalog entry

| Product | Need | Notes |
| --- | --- | --- |
| TotalDAC d1-twelve MK2 | new key | Currently only `totaldac d1 unity` covers TotalDAC. The d1-twelve substring `totaldac d1 12` or `totaldac d1 twelve` is not in the overlay map. Catalog entry exists. |
