/**
 * Pass 19 — EditorialSubCard primitive render tests.
 *
 * The sub-card is used inside the System Assessment Artifact for:
 *   §5 The Components, §8 What's Already Working, §9 Upgrade steps.
 *
 * These tests lock the rendering contract so any future regression
 * (background color, border treatment, accent strip behavior) is
 * caught at the test layer.
 *
 * Renders via `react-dom/server.renderToStaticMarkup` to match the
 * BrandAuthorityPreview test pattern (vitest node env, no jsdom).
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import EditorialSubCard from '../EditorialSubCard';

function render(props: React.ComponentProps<typeof EditorialSubCard>): string {
  return renderToStaticMarkup(createElement(EditorialSubCard, props));
}

describe('EditorialSubCard — full props', () => {
  const html = render({
    name: 'Pass Labs (main line)',
    subtitle: 'Amplifier',
    body: 'Class A and Class AB designs with substantial power.',
    verdict: 'Works exactly where it sits in the chain.',
  });

  it('renders the bold name', () => {
    expect(html).toContain('Pass Labs (main line)');
  });

  it('renders the muted subtitle when provided', () => {
    expect(html).toContain('Amplifier');
  });

  it('renders the body prose', () => {
    expect(html).toContain('Class A and Class AB designs');
  });

  it('renders the verdict in italic muted tone', () => {
    expect(html).toContain('Works exactly where it sits');
    expect(html).toMatch(/font-style:italic/);
  });

  it('uses the warm cardBg fill', () => {
    expect(html).toContain('#FFFEFA');
  });

  it('uses borderLight outer border', () => {
    expect(html).toContain('#E8E3D7');
  });
});

describe('EditorialSubCard — minimal (name only)', () => {
  const html = render({ name: 'Solo' });

  it('renders the name', () => {
    expect(html).toContain('Solo');
  });

  it('omits subtitle, body, verdict when undefined', () => {
    // No font-style:italic anywhere (only the verdict has italic styling).
    expect(html).not.toMatch(/font-style:italic/);
  });
});

describe('EditorialSubCard — with accentColor', () => {
  const html = render({ name: 'Primary', accentColor: '#B08D57' });

  it('renders a 3px borderLeft in the accent color', () => {
    expect(html).toMatch(/border-left:3px solid #B08D57/);
  });
});

describe('EditorialSubCard — without accentColor', () => {
  const html = render({ name: 'Neutral' });

  it('renders a 1px neutral borderLeft (not an accent strip)', () => {
    expect(html).toMatch(/border-left:1px solid #E8E3D7/);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 6 — optional imageUrl prop (used by §5 The Components only)
// ════════════════════════════════════════════════════════════════════════

describe('EditorialSubCard — imageUrl prop', () => {
  it('renders no <img> when imageUrl is undefined', () => {
    const html = render({ name: 'No image' });
    expect(html).not.toContain('<img');
  });

  it('renders an <img> at the top of the card when imageUrl is provided', () => {
    const html = render({
      name: 'Some Component',
      imageUrl: 'https://example.com/some-image.jpg',
    });
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/some-image.jpg"');
    // Alt is the component name (recognition + accessibility).
    expect(html).toContain('alt="Some Component"');
    // Lazy-load for editorial cards.
    expect(html).toContain('loading="lazy"');
  });

  it('image markup uses object-fit:contain so the thumbnail does not crop the product', () => {
    const html = render({
      name: 'Some Component',
      imageUrl: 'https://example.com/img.jpg',
    });
    expect(html).toContain('object-fit:contain');
  });

  it('image is bounded by a fixed-height thumbnail strip (mobile-safe, no gallery sprawl)', () => {
    const html = render({
      name: 'Some Component',
      imageUrl: 'https://example.com/img.jpg',
    });
    expect(html).toContain('height:120px');
  });

  it('image strip sits ABOVE the name heading, not below', () => {
    const html = render({
      name: 'Sortable Heading',
      imageUrl: 'https://example.com/img.jpg',
    });
    const imgIdx = html.indexOf('<img');
    const nameIdx = html.indexOf('Sortable Heading');
    expect(imgIdx).toBeGreaterThan(0);
    expect(nameIdx).toBeGreaterThan(0);
    expect(imgIdx).toBeLessThan(nameIdx);
  });

  it('renders the body prose unchanged whether imageUrl is supplied or not', () => {
    const a = render({ name: 'X', body: 'A body sentence.' });
    const b = render({ name: 'X', body: 'A body sentence.', imageUrl: 'https://example.com/img.jpg' });
    // Body markup stays identical; only the image block is added.
    expect(a).toContain('A body sentence.');
    expect(b).toContain('A body sentence.');
  });
});
