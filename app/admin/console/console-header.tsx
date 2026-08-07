import BrandHome from '../../components/brand-home.tsx';
import AdminAutoRefresh from '../auto-refresh.tsx';
import ThemeToggle from './theme-toggle.tsx';
import SignOut from './sign-out.tsx';

// THE CONSOLE'S OWN HEADER — one row, worn by the console and every subpage alike.
//
// Jay, 2026-08-01, on the shared brand bar plus a greeting row plus a title block: "reclaim all of the real
// estate that way." Three stacked bands of chrome pushed the actual work below the fold on a laptop, and off
// the screen entirely on a phone. Everything that isn't content now lives in this one 60px row.
//
// WHY IT'S NOT THE SHARED BRAND BAR. Jay: "there's a part of them being 'separate apps' I believe has more
// advantages than not, they serve different functions so they need to evolve on their own." So the console
// stops borrowing the member app's header and gets one that can change without touching a member surface.
// What must NOT diverge is the palette and the voice — those are the brand, and they stay shared.
//
// THE BULLSEYE IS GONE. It's navy artwork on charcoal; inverting it read as a smudge rather than a mark.
// The wordmark stays (still inverted, still the home button via BrandHome, which resolves /admin/* → the
// console) and the greeting takes the space the mark used to hold.

export default function ConsoleHeader({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <header className="fch">
      <BrandHome className="fch-brand" aria-label="Founder Console home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="fch-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
      </BrandHome>
      <div className="fch-tools">
        {/* Jay's own spec, punctuation included: "Comma because it's grammatically correct and exclamation
            because it'll just make me feel better." */}
        <span className="fch-hi">Hi, Jay!</span>
        {/* Live + Refresh moved up out of the page body. AdminAutoRefresh is also what slides the admin
            session forward, so it has to be on every console surface, not just the home. */}
        <AdminAutoRefresh />
        <ThemeToggle theme={theme} />
        <SignOut />
      </div>
    </header>
  );
}
