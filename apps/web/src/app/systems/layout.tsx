import type { Metadata } from 'next';

// My Systems is a private collection — named in the tab, kept out of
// search indexes (applies to every /systems/* page).
export const metadata: Metadata = {
  title: 'My Systems',
  robots: { index: false },
};

export default function SystemsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
