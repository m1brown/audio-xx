import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackLinkClick,
  trackCardView,
  trackPreferenceSignal,
  getInteractionEvents,
  getInteractionSummary,
  clearInteractionEvents,
} from '../interaction-tracker';

describe('Interaction Tracker', () => {
  beforeEach(() => {
    clearInteractionEvents();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('tracks link clicks with full metadata', () => {
    trackLinkClick({
      product: 'Naim Nait XS 3',
      category: 'amplifier',
      pickRole: 'top_pick',
      linkKind: 'buy_new',
      linkLabel: 'Buy new — Naim',
      linkUrl: 'https://www.naimaudio.com',
    });

    const events = getInteractionEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('link_click');
    expect(events[0].product).toBe('Naim Nait XS 3');
    expect(events[0].linkKind).toBe('buy_new');
    expect(events[0].linkUrl).toBe('https://www.naimaudio.com');
    expect(events[0].timestamp).toBeTruthy();
  });

  it('tracks card views', () => {
    trackCardView({ product: 'Chord Qutest', pickRole: 'value_pick' });

    const events = getInteractionEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('card_view');
    expect(events[0].product).toBe('Chord Qutest');
    expect(events[0].pickRole).toBe('value_pick');
  });

  it('tracks preference signals', () => {
    trackPreferenceSignal({ signal: 'I prefer warmth over detail', category: 'amplifier' });

    const events = getInteractionEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('preference_signal');
    expect(events[0].meta).toEqual({ signal: 'I prefer warmth over detail', category: 'amplifier' });
  });

  it('provides accurate summary', () => {
    trackCardView({ product: 'Naim Nait XS 3' });
    trackCardView({ product: 'Hegel H95' });
    trackLinkClick({ product: 'Naim Nait XS 3', linkKind: 'buy_new', linkLabel: 'Naim', linkUrl: 'https://naim.com' });
    trackLinkClick({ product: 'Naim Nait XS 3', linkKind: 'buy_used', linkLabel: 'HiFi Shark', linkUrl: 'https://hifishark.com' });
    trackLinkClick({ product: 'Hegel H95', linkKind: 'further_reading', linkLabel: 'Review', linkUrl: 'https://review.com' });

    const summary = getInteractionSummary();
    expect(summary.total).toBe(5);
    expect(summary.byType.card_view).toBe(2);
    expect(summary.byType.link_click).toBe(3);
    expect(summary.byLinkKind.buy_new).toBe(1);
    expect(summary.byLinkKind.buy_used).toBe(1);
    expect(summary.byLinkKind.further_reading).toBe(1);
    expect(summary.topProducts[0]).toEqual({ product: 'Naim Nait XS 3', clicks: 2 });
  });

  it('respects ring buffer limit', () => {
    for (let i = 0; i < 250; i++) {
      trackCardView({ product: `Product ${i}` });
    }
    expect(getInteractionEvents()).toHaveLength(200);
  });

  it('clears events', () => {
    trackCardView({ product: 'Test' });
    expect(getInteractionEvents()).toHaveLength(1);
    clearInteractionEvents();
    expect(getInteractionEvents()).toHaveLength(0);
  });
});
