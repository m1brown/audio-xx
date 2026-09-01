# Typography — long-form assessment body

**Status:** recorded, NOT implemented. Must not ride along in a reasoning or
evidence commit.

Established from the 100% production capture of the beta system
(`Notes on Your System5.pdf`, 17/08/2026). Body lines run ~58 characters where
a serif at this measure wants 65–75: the type is too large for its column,
which produces both the loose feel and the three-page run.

| Token | Now | Proposed | Effect |
|---|---|---|---|
| `FONTS.bodySize` | `0.92rem` (14.7px) | `0.83rem` (13.3px) | −9.8% |
| `FONTS.smallSize` | `0.92rem` | `0.83rem` | moves with body |
| `bodyLine` (long-form paragraphs) | `1.9` | `1.78` | line box 28.0 → 23.6px |
| `FONTS.lineHeight` (lists, compact blocks) | `1.68` | `1.62` | 24.7 → 21.5px |

All in `apps/web/src/components/advisory/AdvisoryMessage.tsx`.

**Explicitly unchanged:** `labelSize` `0.82rem`, `sectionHeading` `1.38rem`,
`labelTracking`, `labelWeight`, provenance badges, component-name headings,
navigation, cards, controls. The hierarchy widens rather than shifts — headings
and labels hold station while the body recedes.

Leading drops proportionally faster than the type: at `0.83rem` the current
`1.9` ratio reads as loose.

**Open question before implementing:** the capture is a print/PDF render. If the
print path carries its own stylesheet, these screen tokens will not fully
explain what the PDF shows, and both paths need checking.
