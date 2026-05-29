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
