# Defect — mutable first-party citation

**Logged** 2026-08-23 · **Status** open, deferred · **Class** provenance
**Not an image defect.** Found during image acquisition; the images were a symptom.

## What happened

`FRANCE_FACTS` cites this URL as the first-party source for several
**Eversolo DMP-A6** facts — parent company, successor, range position:

```
https://www.eversolo.com/Product/index/model/DMP-A6/target/7abWHw++oHhKKmVViAFMcQ==.html
```

That URL today returns:

```
<title>Eversolo DMP-A6 Gen 2 High-Fidelity Music Streamer — Eversolo</title>
og:title: "Eversolo DMP-A6 Gen 2 High-Fidelity Music Streamer"
```

35 mentions of "DMP-A6 Gen 2" against 3 of the bare "DMP-A6". Eversolo replaced
the product page **in place** when the Gen 2 shipped. The URL did not move; the
product it describes did.

## Why it matters

A citation is supposed to let a reader check a claim. This one now leads to a
**different product**, so:

- a fact captured about the original silently acquires a Gen 2 citation;
- anyone following the link is shown the successor and may conclude Audio XX
  confused the two;
- the `retrievedAt` date is the only evidence the citation was ever correct,
  and nothing compares the page's current identity against the product the
  fact belongs to.

This is the same failure the image work just fixed, one layer up. There, an
asset named `eversolo-a6-gen2-thumb.webp` was keyed to the plain DMP-A6 and
the original was shown a photograph of its successor. Exact identity matching
caught nothing, because the matcher was right and the *key* was wrong. Here the
URL is right and the *page behind it* changed.

## What this is NOT

- Not a reason to rewrite or discard the historical facts. They were captured
  when the page described the original, and they remain what the maker
  published about it.
- Not fixable by re-pointing the URL. There is no first-party page for the
  original DMP-A6 that I could find; the maker does not keep one.
- Not an image problem. Removing the image does not make the citation honest.

## What a fix would need

Roughly, and deliberately unspecified pending design:

1. **Identity verification on the cited page**, not just reachability — does
   the page still name the product the fact belongs to?
2. **A drift state** on a stored fact: `citation_verified` / `citation_drifted`
   / `citation_unreachable`, distinct from the fact's own knowledge state, in
   the same way `sourceClass` and `state` are already independent axes.
3. **A decision about what a drifted citation licenses.** A fact whose source
   can no longer be checked is not false, but it is no longer first-party
   *verifiable*, and the assessment should probably say so rather than link to
   a page describing something else.
4. **Archival capture**, so a first-party claim stays checkable after the maker
   moves on. This is the expensive option and the only one that fully works.

## Scope note

Likely widespread rather than specific to Eversolo — makers routinely replace
product pages on release. Any stored `sourceUrl` older than a product cycle is
a candidate. Worth an audit pass before it is worth a mechanism.
