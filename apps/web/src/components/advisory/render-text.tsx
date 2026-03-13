/**
 * Inline text renderer — converts **bold** markers to <strong> elements.
 *
 * Used across memo-format advisory components for emphasis within prose
 * and bullet items. Returns a React fragment with mixed text and <strong> nodes.
 *
 * Only handles **bold** — no other markdown. Keeps rendering predictable.
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
