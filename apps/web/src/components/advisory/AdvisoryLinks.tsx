/**
 * Grouped link rendering — reference links, dealers, reviews.
 */

import type { AdvisoryLink } from '../../lib/advisory-response';

function LinkLine({ links, label }: { links: AdvisoryLink[]; label?: string }) {
  return (
    <div style={{ marginBottom: '0.3rem' }}>
      {label && (
        <span style={{ color: '#888', fontSize: '0.82rem', marginRight: '0.5rem' }}>{label}</span>
      )}
      {links.map((link) => (
        <span key={link.url} style={{ marginRight: '1.2rem' }}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#4a7a8a', textDecoration: 'none' }}
          >
            {link.label}
            {link.region && link.region !== 'global' && (
              <span style={{ color: '#999', fontSize: '0.8rem', marginLeft: '0.25rem' }}>
                ({link.region})
              </span>
            )}
            {' '}↗
          </a>
        </span>
      ))}
    </div>
  );
}

interface AdvisoryLinksProps {
  links: AdvisoryLink[];
}

export default function AdvisoryLinks({ links }: AdvisoryLinksProps) {
  const refLinks = links.filter((l) => !l.kind || l.kind === 'reference');
  const dealerLinks = links.filter((l) => l.kind === 'dealer');
  const reviewLinks = links.filter((l) => l.kind === 'review');

  return (
    <div style={{ fontSize: '0.88rem', color: '#666', lineHeight: 1.8 }}>
      {refLinks.length > 0 && <LinkLine links={refLinks} />}
      {dealerLinks.length > 0 && <LinkLine links={dealerLinks} label="Dealers:" />}
      {reviewLinks.length > 0 && <LinkLine links={reviewLinks} label="Reference:" />}
    </div>
  );
}
