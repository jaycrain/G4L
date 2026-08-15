import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import './globals.css';
import PwaClient from './pwa-client.tsx';
import DetectZone from './dashboard/detect-zone.tsx';
import { APP_VERSION, buildRef } from '../lib/version.ts';
// import FeedbackLauncher from './feedback-launcher.tsx'; // Send Feedback pill — dropped for now (reinstate with the render below)
import BackToDashboard from './components/back-to-dashboard.tsx';
import BrandHome from './components/brand-home.tsx';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-barlow',
});

// The mobile home billboard's all-caps signature style (Mobile slice 1). Loaded but unused until the mobile home renders.
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['800', '900'],
  variable: '--font-condensed',
});

/**
 * THE ONE MONOSPACE (Jay picked it, 2026-08-15).
 *
 * `--font-mono` was referenced by the footer's build hash and never declared, so the browser fell past it to
 * whatever the device happened to own — SF Mono on Apple, Consolas on Windows, a lottery on Android. Nobody had
 * chosen it; the fallback had.
 *
 * IBM Plex Mono over JetBrains Mono on Jay's call: it is humanist and sits closer to Barlow, and it still has
 * the slashed zero, which is the whole reason the hash is monospace — so a member can read a build back without
 * 0/O or 1/l ambiguity when something goes wrong. Warmth over forensics, at almost no cost.
 *
 * 400 only: this appears at 11px in a footer. A second weight would be bytes for a face nothing emphasises.
 * Loaded through next/font like Barlow — self-hosted at build time, so no third-party request and no flash of
 * fallback text before it swaps.
 */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
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
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`}>
      <body>
        <main>
          <div className="brand-bar">
            {/* W-47a: the logo is the home button. Two SEPARATE links keep the brand-bar's space-between
                layout (wordmark left, bullseye right) while both stay tappable.
                BrandHome resolves the destination from the ROUTE: '/admin/*' → the Founder Console, everything
                else → '/', which redirects an authed member to their dashboard. Hard-wiring '/' threw an
                operator out of the console into the member app (Jay, 2026-08-01). */}
            <BrandHome className="brand-home" aria-label="Go to your G4L home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
            </BrandHome>
            <BrandHome className="brand-home" aria-hidden="true" tabIndex={-1}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
            </BrandHome>
          </div>
          {/* W-47: universal "← Dashboard" on every member subpage + Session (Suspense for the IDQ's ?member= query read). */}
          <Suspense fallback={null}>
            <BackToDashboard />
          </Suspense>
          {children}
        </main>
        {/* THE PROPRIETARY NOTICE — on every screen, which it had silently stopped being (Jay, 2026-08-08).
            One CSS rule (body.redesign-on) hid it on every LOGGED-IN surface while leaving it on /login and
            /onboarding, so it appeared exactly where there was nothing to protect and vanished everywhere a
            member's material is. Introduced by 8a64b68 "confidentiality footer on every screen (evaluation
            build)" — accurate then, when the app was something you showed evaluators. Prod has real members now.
            WORDING: it asserts ownership, names WHAT is proprietary (the program, the assessments, the content —
            the defensible things), and draws the line at the member's own writing, because claiming that would
            contradict everything else this product says. No ® — the mark is not registered. */}
        <footer className="confidential-footer">
          © 2026 Adjacent Lab, LLC. All rights reserved. The Grinta for Life program, its assessments and its
          content are proprietary. What you write here stays yours.
          {/* The version + build, for Charter. A member reporting something can read this back, and it says which
              BUILD they were on — the version alone spans dozens of deploys. Quiet by design: it sits with the
              notice rather than in the chrome, because it is for the rare moment something goes wrong. */}
          {/* SPLIT (Jay, 2026-08-15). The version is chrome and reads as part of the notice, so it stays in
              Barlow. Only the BUILD REF goes monospace — it is the half someone reads back over a phone, and the
              only half where 0/O or 1/l costs anything. Setting the whole line in mono made the version look
              like a foreign object in the footer. */}
          <span className="app-version"> · {APP_VERSION} · <span className="app-build">{buildRef()}</span></span>
        </footer>
        <PwaClient />
        {/* Records the member's timezone from the browser, once per session, so every date in the product is
            their date and not UTC. Lives here rather than on the dashboard because the dashboard has three
            render branches and the first version was mounted below the one prod actually uses. */}
        <DetectZone />
        {/* Send Feedback pill dropped for now (Jay, 2026-07-23) — reinstate by uncommenting this + the import above. */}
        {/* <FeedbackLauncher /> */}
      </body>
    </html>
  );
}
