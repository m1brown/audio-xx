/**
 * Entitlement status lines (MVP M5) — one restrained sentence per state,
 * in the editorial voice. Shared by My Systems and /account so the
 * product never disagrees with itself about billing.
 */
import type { Entitlement } from './entitlement';

function longDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function statusLine(e: Entitlement): string {
  switch (e.state) {
    case 'trial':
      return e.trialDaysLeft > 14
        ? `Free trial · ${e.trialDaysLeft} days remaining`
        : `Free trial ends ${longDate(e.trialEndsAt)}`;
    case 'subscriber':
      return 'My Systems subscription active';
    case 'canceling':
      return `Subscription ends ${longDate(e.paidThrough)}`;
    case 'past_due':
      return e.canManage
        ? `Payment issue — access continues until ${longDate(e.paidThrough)}`
        : 'Payment issue — your collection remains readable';
    case 'expired':
      return 'Trial ended — your collection remains yours to read';
  }
}
