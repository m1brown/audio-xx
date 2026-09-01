import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Server/client boundary safety for the advisory card tree.
 *
 * `/brand/[slug]` is a Server Component that imports AdvisoryProductCard.
 * Anything that module renders must therefore be serializable — no function
 * may be passed as a prop, because functions cannot cross the server→client
 * boundary. When one does, Next.js throws
 *
 *   "Event handlers cannot be passed to Client Component props"
 *
 * at render time and the whole route 500s.
 *
 * This has now happened twice. The first time, `useEffect` and inline
 * `onClick` handlers lived directly in AdvisoryProductCard; the fix moved
 * them into CardTelemetry.tsx ('use client'). The second time, GTM commerce
 * work added a local `trackOutboundCommerceClick` and passed it down as an
 * `onClick` prop to `TrackedAnchor` — reintroducing the identical defect by
 * a different route, and 500ing every brand page in production.
 *
 * Neither failure was caught by any test: vitest renders these components
 * in a client context where function props are legal, and `next build`
 * compiles fine because this is a runtime serialization error, not a
 * compile error. A source-level assertion is the cheap, reliable guard.
 *
 * Rule: client-only behaviour belongs inside a 'use client' module. Handlers
 * are installed there, not passed in.
 */

const CARD = join(__dirname, '..', 'AdvisoryProductCard.tsx');
const TELEMETRY = join(__dirname, '..', 'CardTelemetry.tsx');

describe('advisory card server/client boundary', () => {
  it('AdvisoryProductCard declares no event handlers', () => {
    const src = readFileSync(CARD, 'utf8');
    // Strip comments so prose describing the bug does not trip the check.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const handlers = code.match(/\bon[A-Z]\w*\s*=\s*\{/g) ?? [];
    expect(
      handlers,
      `AdvisoryProductCard.tsx must stay server-renderable — found ${handlers.length} ` +
        `event-handler prop(s): ${handlers.join(', ')}. Move the behaviour into ` +
        `CardTelemetry.tsx ('use client') and have the client component install ` +
        `the handler itself instead of receiving it as a prop.`,
    ).toEqual([]);
  });

  it('AdvisoryProductCard is not itself a client module', () => {
    const src = readFileSync(CARD, 'utf8');
    // If this ever flips to 'use client', the brand page silently pulls the
    // entire card tree into the client bundle. That is a design change, not
    // a bug fix — it should be a deliberate decision, not a drive-by edit.
    expect(src.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('CardTelemetry is a client module and owns the click handlers', () => {
    const src = readFileSync(TELEMETRY, 'utf8');
    expect(src.trimStart().startsWith("'use client'")).toBe(true);
    // Both trackers must fire from inside the client component.
    expect(src).toMatch(/trackLinkClick\(/);
    expect(src).toMatch(/trackOutboundCommerceClick\(/);
  });

  it('TrackedAnchor does not accept an onClick prop', () => {
    const src = readFileSync(TELEMETRY, 'utf8');
    const propsBlock = src.slice(src.indexOf('export function TrackedAnchor'));
    // The prop type must not declare onClick — accepting one would re-open
    // the boundary hole this module exists to close.
    const typeBlock = propsBlock.slice(0, propsBlock.indexOf('}) {'));
    expect(typeBlock).not.toMatch(/\bonClick\b/);
  });
});
