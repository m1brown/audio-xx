import Link from 'next/link';
import { getAffiliateState } from '@/lib/affiliate-config';

export const metadata = {
  title: 'Affiliate Disclosure',
  description: 'How Audio XX uses affiliate links.',
};

export default function AffiliateDisclosurePage() {
  // Derived from the SAME configuration that monetizes the links, so this
  // page cannot describe a state the deployment is not in. Naming a program
  // is gated on that program's own credential: enrollment in one is not
  // enrollment in the other.
  const { amazon, ebay, any } = getAffiliateState();
  const programs = [
    amazon ? 'the Amazon Associates program' : null,
    ebay ? 'the eBay Partner Network' : null,
  ].filter(Boolean) as string[];
  const programList = programs.length === 2
    ? `${programs[0]} and ${programs[1]}`
    : programs[0];
  const taggedMarkets = [
    amazon ? 'Amazon' : null,
    ebay ? 'eBay' : null,
  ].filter(Boolean) as string[];
  const taggedList = taggedMarkets.length === 2
    ? `${taggedMarkets[0]} and ${taggedMarkets[1]}`
    : taggedMarkets[0];

  return (
    <div style={{ maxWidth: 600 }}>
      <h1>Affiliate Disclosure</h1>

      {any ? (
        <p className="mb-1">
          Some links on Audio&thinsp;XX are <strong>affiliate links</strong>.
          When you follow one and make a purchase, Audio&thinsp;XX may earn a
          small commission at no additional cost to you. Commission plays no
          part in what is recommended.
        </p>
      ) : (
        <p className="mb-1">
          Audio&thinsp;XX currently earns <strong>no commission</strong> from
          any link on this site. Every product, manufacturer, and used-market
          link is provided purely as a convenience.
        </p>
      )}

      <h2>How it works today</h2>
      {any ? (
        <p className="mb-1">
          Product cards link to manufacturer pages and to used-market searches
          (eBay, HiFi Shark, Audiogon). Shopping links to {taggedList} carry an
          affiliate tracking parameter, which is how a purchase is attributed
          to Audio&thinsp;XX. Manufacturer and dealer links carry no tracking.
        </p>
      ) : (
        <p className="mb-1">
          Product cards link to manufacturer pages and to used-market searches
          (eBay, HiFi Shark, Audiogon). None of these links carry affiliate
          tracking, and Audio&thinsp;XX receives nothing if you make a purchase.
        </p>
      )}

      <h2>If that changes</h2>
      {any ? (
        <p className="mb-1">
          If affiliate participation ends, or extends to further programs, this
          page and the site footer will say so plainly. The principles below
          apply unchanged either way: commercial participation does not affect
          our recommendations.
        </p>
      ) : (
        <p className="mb-1">
          Audio&thinsp;XX may in future participate in affiliate programs (such
          as Amazon Associates or the eBay Partner Network) to support the site.
          If and when affiliate links become active, this page and the site
          footer will say so plainly, and the principles below will continue to
          apply unchanged: commercial participation does not affect our
          recommendations — not today, and not then.
        </p>
      )}

      <h2>Independence</h2>
      <p className="mb-1">
        Affiliate relationships do not influence which products are recommended
        or how they are presented. Recommendations are based on your
        preferences, listening priorities, and system context — never on
        commission potential. Products from brands not available on Amazon are
        recommended just as readily. Amazon links are provided as a convenience
        alongside manufacturer and dealer links.
      </p>
      <p className="mb-1">
        Audio&thinsp;XX does not make &ldquo;best deal&rdquo; or
        &ldquo;recommended seller&rdquo; claims. Affiliate and outbound links
        — Amazon, eBay, HiFi Shark, manufacturer, dealer — are availability and
        convenience tools only. They are never used as evidence for a
        recommendation, never weighted into product scoring, and never used to
        decide which products are surfaced.
      </p>

      <h2>Pricing and availability</h2>
      <p className="mb-1">
        Prices and availability shown on product cards are catalog values,
        refreshed manually. They are approximate and may not reflect current
        market conditions. Audio&thinsp;XX does not synchronize live pricing
        or inventory and does not make real-time stock claims. Check the
        linked manufacturer, dealer, or used-market search for current
        pricing and availability.
      </p>

      <h2>Other relationships</h2>
      {any ? (
        <p className="mb-1">
          Audio&thinsp;XX participates in {programList}. Beyond affiliate
          participation, Audio&thinsp;XX has no commercial relationship with any
          manufacturer, dealer, or marketplace — no sponsorship, no paid
          placement, no fee for coverage. This page will be updated if that
          changes.
        </p>
      ) : (
        <p className="mb-1">
          Audio&thinsp;XX currently participates in no affiliate program and has
          no commercial relationship with any manufacturer, dealer, or
          marketplace — no sponsorship, no paid placement, no fee for coverage.
          This page will be updated if that changes.
        </p>
      )}

      <div className="mt-2">
        <Link href="/privacy" className="small muted">Privacy Policy</Link>
        {' · '}
        <Link href="/" className="small muted">Back to home</Link>
      </div>
    </div>
  );
}
