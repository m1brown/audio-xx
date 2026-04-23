import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import StartOverBar from '@/components/StartOverBar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Audio XX',
  description: 'Listener-driven suggestion engine for thoughtful hi-fi system building',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          <Nav />
          <main className="container">
            {children}
          </main>
          <StartOverBar />
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
