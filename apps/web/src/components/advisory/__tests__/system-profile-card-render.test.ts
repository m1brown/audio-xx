/**
 * Pass 19 — SystemProfileCard render tests.
 *
 * Locks the §2 *Profile* surface contract:
 *   - 3 labeled rows when all data present
 *   - borderLeft 3px accent + cardBg + borderLight everywhere else
 *   - independently optional rows (renders any subset)
 *   - renders null when all 3 fields are absent
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import SystemProfileCard from '../SystemProfileCard';

function render(props: React.ComponentProps<typeof SystemProfileCard>): string {
  return renderToStaticMarkup(createElement(SystemProfileCard, props));
}

describe('SystemProfileCard — full state', () => {
  const html = render({
    whatItIs: 'A warm tube-based source-first system.',
    whatItLeansToward: 'Flowing midrange, harmonically dense.',
    whatItTrades: 'Headroom and transient bite for tonal naturalness.',
  });

  it('renders all 3 labeled rows', () => {
    expect(html).toContain('What it is:');
    expect(html).toContain('What it leans toward:');
    expect(html).toContain('What it trades:');
  });

  it('renders the row values', () => {
    expect(html).toContain('warm tube-based source-first system');
    expect(html).toContain('Flowing midrange');
    expect(html).toContain('Headroom and transient bite');
  });

  it('uses the Quick Identity card visual contract', () => {
    // borderLeft 3px in warm accent
    expect(html).toMatch(/border-left:3px solid #B08D57/);
    // cardBg fill
    expect(html).toContain('#FFFEFA');
    // borderLight outer
    expect(html).toContain('#E8E3D7');
  });

  it('uses the Profile aria-label', () => {
    expect(html).toContain('aria-label="System Profile"');
  });
});

describe('SystemProfileCard — partial state (only what it is)', () => {
  const html = render({ whatItIs: 'Just the topology line.' });

  it('renders only the present row', () => {
    expect(html).toContain('What it is:');
    expect(html).not.toContain('What it leans toward:');
    expect(html).not.toContain('What it trades:');
  });
});

describe('SystemProfileCard — empty (all absent)', () => {
  const html = render({});

  it('renders nothing', () => {
    expect(html).toBe('');
  });
});

describe('SystemProfileCard — F4 / cross-brand invariants', () => {
  it('does not render any reviewer-quote markup', () => {
    const html = render({
      whatItIs: 'Test',
      whatItLeansToward: 'Test',
      whatItTrades: 'Test',
    });
    expect(html).not.toContain('<blockquote');
    expect(html).not.toContain('<cite');
  });
});
