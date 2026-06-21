import type { Metadata, Viewport } from 'next';
import { Barlow } from 'next/font/google';
import './globals.css';
import PwaClient from './pwa-client.tsx';
import FeedbackLauncher from './feedback-launcher.tsx';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'Grinta for Life',
  description: 'Reclaim your identity. Measured by the ID Score.',
  applicationName: 'Grinta for Life',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'G4L' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#374f63',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable}>
      <body>
        <main>
          <div className="brand-bar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
          </div>
          {children}
        </main>
        <footer className="confidential-footer">
          Confidential — © 2026 Adjacent Lab, LLC. Prepared for evaluation only. Do not copy, distribute, or disclose
          without written permission.
        </footer>
        <PwaClient />
        <FeedbackLauncher />
      </body>
    </html>
  );
}
