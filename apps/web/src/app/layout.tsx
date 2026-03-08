import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Audio XX',
  description: 'Listener-driven suggestion engine for thoughtful hi-fi system building',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="container">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
