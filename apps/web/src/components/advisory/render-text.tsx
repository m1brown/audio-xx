/**
 * Inline text renderer — converts **bold** markers to <strong> elements.
 *
 * Used across memo-format advisory components for emphasis within prose
 * and bullet items. Returns a React fragment with mixed text and <strong> nodes.
 *
 * Only handles **bold** — no other markdown. Keeps rendering predictable.
 *
 * `renderTextWithProductLinks` extends this to wrap bold product names
 * in anchor tags when a verified URL is available.
 */

import React from 'react';

/**
 * Render a string with **bold** markers converted to <strong> elements.
 * Returns the original string if no markers are present (avoids unnecessary wrapping).
 */
export function renderText(text: string): React.ReactNode {
  if (!text.includes('**')) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf('**');
    if (openIdx === -1) {
      parts.push(remaining);
      break;
    }

    // Text before the opening **
    if (openIdx > 0) {
      parts.push(remaining.slice(0, openIdx));
    }

    // Find the closing **
    const afterOpen = remaining.slice(openIdx + 2);
    const closeIdx = afterOpen.indexOf('**');
    if (closeIdx === -1) {
      // No closing marker — treat as literal
      parts.push(remaining.slice(openIdx));
      break;
    }

    // Bold segment
    const boldText = afterOpen.slice(0, closeIdx);
    parts.push(<strong key={key++}>{boldText}</strong>);
    remaining = afterOpen.slice(closeIdx + 2);
  }

  return <>{parts}</>;
}

// ── Product-link styling ──────────────────────────────────
const productLinkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(168, 152, 112, 0.45)',
  textUnderlineOffset: '2px',
  textDecorationThickness: '1.5px',
  transition: 'text-decoration-color 0.15s ease',
};

/**
 * Maps product names (lowercased, collapsed whitespace) to verified URLs.
 * Built once per render from catalog data — no fabricated URLs.
 */
export type ProductUrlMap = Map<string, string>;

/** Normalise a product name for map lookup. */
function normalizeForLookup(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Like `renderText`, but wraps **bold** product names in clickable anchor
 * tags when a verified URL exists in `urlMap`.
 *
 * Linking rules:
 *   - Only the first occurrence of each product per call is linked.
 *   - Product headings (bold names) are always linked when a URL exists.
 *   - If no URL exists for a bold segment, it renders as plain <strong>.
 *   - External links open in a new tab with rel="noopener noreferrer".
 *   - Section-level non-product bold (e.g. "Do not touch:") is never linked.
 */
export function renderTextWithProductLinks(
  text: string,
  urlMap: ProductUrlMap,
): React.ReactNode {
  if (!text.includes('**')) return text;
  if (urlMap.size === 0) return renderText(text);

  const linked = new Set<string>(); // track first-occurrence per call
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf('**');
    if (openIdx === -1) {
      parts.push(remaining);
      break;
    }

    if (openIdx > 0) {
      parts.push(remaining.slice(0, openIdx));
    }

    const afterOpen = remaining.slice(openIdx + 2);
    const closeIdx = afterOpen.indexOf('**');
    if (closeIdx === -1) {
      parts.push(remaining.slice(openIdx));
      break;
    }

    const boldText = afterOpen.slice(0, closeIdx);
    const lookupKey = normalizeForLookup(boldText);
    const url = urlMap.get(lookupKey);

    if (url && !linked.has(lookupKey)) {
      // Linked bold product name
      linked.add(lookupKey);
      parts.push(
        <strong key={key++}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={productLinkStyle}
            onMouseEnter={(e) => {
              (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = 'rgba(168, 152, 112, 0.85)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = 'rgba(168, 152, 112, 0.45)';
            }}
          >
            {boldText}
          </a>
        </strong>,
      );
    } else {
      // Plain bold — either no URL, or already linked earlier in this block
      parts.push(<strong key={key++}>{boldText}</strong>);
    }

    remaining = afterOpen.slice(closeIdx + 2);
  }

  return <>{parts}</>;
}
