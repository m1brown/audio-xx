# Image permission requests — PREPARED, NOT SENT

**Date** 2026-08-24 · **Status** drafts only. Nothing has been sent, and sending
is a founder action.

## What this is testing

Not "can we get a picture of the QRC-2". The question is whether **manufacturer
permission is operationally cheap enough to make photography scalable** — if two
short emails produce two yeses, a permissions programme is worth building; if
they produce silence or legal referrals, image coverage stays demand-driven and
rare, and that is a useful answer too.

So both requests are deliberately narrow. A broad licence request invites a
legal review; a narrow one invites a reply.

## Why permission is the blocker

Identity and provenance are already established for both products — the assets
sit on the makers' own product pages, so identity rests on the embedding page
rather than on a filename. What is missing is the third predicate, and each
maker states plainly that it is missing:

- Acora: "© 2026 Acora Acoustics. All rights reserved"
- Butler: "© 1995-2026 Butler Audio Inc. All rights reserved", plus "Use of
  these trademarks is by permission only and is strictly enforced"

Neither publishes media-use terms, a press kit, or downloadable press assets.
There is no documentary route to a rights basis, which is why asking is the
only remaining option.

---

## Draft 1 — Acora Acoustics (QRC-2)

**Subject:** Permission to show one QRC-2 photograph in owner system assessments

> Hello,
>
> I run Audio XX, a system-level listening advisor. When someone tells us what
> they own, we write them an assessment of how their components work together —
> what we can establish about the system, and what we deliberately can't.
>
> A listener with a QRC-2 pair prompted this note. Their assessment currently
> shows the QRC-2's published impedance, power handling, driver complement,
> frequency response and weight, but no photograph, because we don't display
> product imagery without the maker's permission.
>
> May we use one official QRC-2 photograph from your product page for that
> purpose? Specifically we would like to:
>
> - reproduce a single official product photograph of the QRC-2;
> - keep a local copy so the image doesn't break when your site changes;
> - show it beside that product in a listener's system assessment;
> - include it in the printable PDF of that assessment;
> - credit Acora Acoustics and link to your product page wherever it appears.
>
> Two things we would not do. The photograph would identify the product only —
> it never supports a claim about how the speaker sounds or measures, and every
> such claim in our assessments is tied to a published source. And we wouldn't
> use it in advertising or imply any endorsement.
>
> A reply to this email saying yes is all we need; we'll record it as the basis
> and honour any conditions or a specific asset you'd prefer we use. If the
> answer is no, that's genuinely fine — we'll show the specifications without a
> photograph, as we do today.
>
> Thank you,
> [name] — Audio XX

**Contact route:** Acora publishes no direct email, phone or enquiry form on
`acoraacoustics.com`; the footer carries only a copyright line, and the dealers
page lists dealer contacts rather than the company's. The practical routes are
(a) a named North American dealer from
`https://acoraacoustics.com/dealers/` asking to be forwarded to Acora, or
(b) the maker's own social channels. **Confidence: low** — this is the one
verification I could not complete, and it should be checked by hand before
sending.

---

## Draft 2 — Butler Audio (MONAD A100)

**Subject:** Permission to show one MONAD A100 photograph in owner system assessments

> Hello,
>
> I run Audio XX, a system-level listening advisor. When someone tells us what
> they own, we write them an assessment of how their components work together.
>
> A listener running MONAD A100 monoblocks into Acora QRC-2s prompted this. The
> assessment quotes your published output — 100W minimum and 128W typical into
> 8 ohms, 200W typical into 4 ohms — and uses the 4-ohm figure to establish that
> the amplifier suits that speaker's load. It shows the 300B tube complement,
> the dimensions and the weight. It shows no photograph, because we don't
> display product imagery without the maker's permission.
>
> May we use one official MONAD photograph from your site? Specifically:
>
> - reproduce a single official product photograph of the MONAD A100;
> - keep a local copy so the image doesn't break when your site changes;
> - show it beside that product in a listener's system assessment;
> - include it in the printable PDF of that assessment;
> - credit Butler Audio and link to your product page wherever it appears.
>
> The photograph would identify the product only — it never supports a claim
> about how the amplifier sounds, and it wouldn't be used in advertising or
> imply endorsement. We note your trademark terms and are asking rather than
> assuming.
>
> If there's a higher-resolution version you'd prefer we use, we'd welcome it.
> A reply saying yes is all we need. If the answer is no, we'll continue showing
> the published specifications without a photograph.
>
> Thank you,
> [name] — Audio XX

**Contact route:** `https://butleraudio.com/contact.php` lists email addresses
for sales, technical support and general questions (email is stated as the
preferred channel, monitored 24/7) and a phone number, **(303) 766-4504**,
9am–5pm Mountain Time weekdays. No dedicated press contact — general enquiries
is the route. **Confidence: verified** from the maker's own contact page.

---

---

## dCS and Audio Research — routes, no drafts yet

Both have practical contact routes. Drafts are deliberately not written for
them, because each has a complication the Acora and Butler requests do not.

**dCS Audio** — `info@dcsaudio.com`, +44 (0)1954 233950, Data Conversion
Systems Ltd, Buckingway Business Park, Swavesey, Cambridgeshire CB24 4AE.
**Confidence: medium** — a general enquiry address, not a named press contact.

dCS is the one product where the blocker is IDENTITY, not rights: every page
on dcsaudio.com returns 403 to an automated client while `/assets/…` returns
200, so a file can be fetched but the page that would establish which product
it depicts cannot. That makes asking unusually valuable — a maker who replies
with an asset states its identity in the same message, clearing both
predicates at once. It also means a bare "may we use a photo?" is the wrong
question; the request should ask them to nominate the Rossini Apex image.

**Audio Research** — `info@audioresearch.com`, 763-577-9700, 6655 Wedgwood
Rd N Suite 115, Maple Grove, MN 55311. A contact form exists.
**Confidence: high** — published on their own contact page.

The complication here is the product. The Reference 5 is discontinued and ARC
publishes no legacy image; the only first-party artefact located is the
non-SE owner's manual PDF. A permission request would have to ask whether ARC
holds any archive photograph of the NON-SE Reference 5 — and "no, only the
SE" is a likely and legitimate answer. Reference 5 SE photography must not be
substituted, so a yes here is worth less than the other three.

Recommended order if the experiment runs: **Acora, then Butler, then dCS,
then ARC** — strongest identity and simplest ask first.

## If a yes arrives

It is a data operation, not a project. The renderer is already wired: an
admitted asset flows from `buildDossierViews` into the conversation, the
artifact and the PDF from one field. What a yes requires is the record —
`rightsBasis`, the reply as `termsUrl`/source, `rightsCheckedAt`, `credit`,
source page, original URL, capture date — and a local copy, since the approved
design stores a governed asset rather than a hot link.

Nothing about staged enforcement changes. One product gaining a photograph is
one product, not a policy shift.
