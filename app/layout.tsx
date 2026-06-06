import type { Metadata } from 'next';
import { Barlow } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'Grinta for Life',
  description: 'Reclaim your identity. Measured by the ID Score.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable}>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
