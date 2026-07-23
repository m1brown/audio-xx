import type { Metadata } from 'next';
import { Fraunces, Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import StartOverBar from '@/components/StartOverBar';
import { Analytics } from '@vercel/analytics/next';

/**
 * Launch typography — Design Doctrine v1 (`docs/design-doctrine-v1.md`).
 *
 * Role discipline (enforced by usage, not by CSS guards):
 *   - Fraunces       → major headlines ONLY
 *   - Source Serif 4 → all reading text (body, standfirst, pull quotes,
 *                      captions, prose)
 *   - Inter          → navigation, metadata, labels, buttons, UI chrome
 *
 * Exposed as CSS variables on <html> using the artifact's canonical
 * names (`--face-display`, `--face-text`, `--face-grotesque`) so the
 * homepage AND the v2 Assessment Artifact pick up the new fonts in
 * lockstep without per-surface wiring.
 *
 * Weights are pinned to the minimum each role actually uses — adding a
 * weight requires a deliberate edit here so we never silently bloat the
 * font payload.
 *
 * `display: 'swap'` avoids FOIT; next/font's adjustFontFallback handles
 * size-adjusted fallback metrics so the swap doesn't cause CLS.
 */

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600'],
  variable: '--face-display',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--face-text',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--face-grotesque',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://audio-xx.com'),
  title: {
    default: 'Audio XX — Notes on Your System',
    template: '%s — Audio XX',
  },
  description:
    'An assessment of how your hi-fi components work together, where the bottlenecks are, and whether anything should change. Free, no account required.',
  openGraph: {
    siteName: 'Audio XX',
    type: 'website',
    title: 'Audio XX — Notes on Your System',
    description:
      'An assessment of how your hi-fi components work together, where the bottlenecks are, and whether anything should change.',
  },
  twitter: {
    card: 'summary',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSerif.variable} ${inter.variable}`}
    >
      <body>
        <Providers>
          <Nav />
          <main className="container">
            {children}
          </main>
          <StartOverBar />
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
