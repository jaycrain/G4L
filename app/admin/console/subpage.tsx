import Link from 'next/link';
import ConsoleHeader from './console-header.tsx';
import ConsoleNav from './console-nav.tsx';
import { getDb } from '../../../lib/db/index.ts';
import { getConsoleTheme } from '../../../lib/founder/state.ts';

// THE CHROME EVERY CONSOLE SUBPAGE WEARS — header, nav row, content. Nothing else.
//
// It used to carry a breadcrumb, an <h1> and a lede on top of the shared brand bar. Jay, 2026-08-01: "We can
// get rid of the Founder Console nav, two other ways to get there. Get rid of Members breadcrumb. Get rid of
// Members and subhead underneath." All three said the same thing twice: the lit tab in the nav row already
// names the page, and a crumb pointing at somewhere that's also in that row was a third route to one place.
//
// WHAT THE CRUMB WAS ACTUALLY LOAD-BEARING FOR is depth — /admin/member/<id> isn't in the tab row, so with
// the crumb gone you'd land on someone's record with nothing saying where you are. That's what `back` is:
// ONE affordance, not a trail, with the parent's tab staying lit.

export default async function ConsoleSubpage({
  title, here, back, showTitle, children,
}: {
  /** Not rendered by default — the lit tab is the visible title. Kept for the accessible name (see below). */
  title: string;
  /** Set when the title is genuinely CONTENT rather than a page name — a member's own name on their record.
   *  Then it's the visible h1 instead of a hidden one, and there is still exactly one. */
  showTitle?: boolean;
  /** The href of the current page, so its tab renders as position rather than as a link to itself. */
  here: string;
  /** Set on sub-sub-pages: the one way back up. The parent's tab stays lit. */
  back?: { label: string; href: string };
  children: React.ReactNode;
}) {
  // The toggle belongs on every console surface, not just the home — you notice the ground is wrong wherever
  // you happen to be standing.
  const theme = await getConsoleTheme(await getDb()).catch(() => 'dark' as const);
  return (
    <div className="fc-app">
      <ConsoleHeader theme={theme} />
      <ConsoleNav here={here} />
      <div className="fc-scroll">
        {back && <Link className="fc-back" href={back.href}>‹ {back.label}</Link>}
        {/* Dropping the visible <h1> would leave the page with nothing to announce itself to a screen reader,
            and "the highlighted pill" is not something a screen reader conveys. Kept, hidden, zero cost. */}
        <h1 className={showTitle ? 'fc-record-name' : 'sr-only'}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
