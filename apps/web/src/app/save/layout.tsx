import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Save System',
  robots: { index: false },
};

export default function SaveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
