import Link from 'next/link';
import { firstName, initials } from '../../lib/member/avatar.ts';

// THE APP TOPBAR — brand · Playbook · account. The ONE definition, at last.
//
// It was written three times: here's-the-markup in redesign-topbar.tsx (subpages), in redesign-dashboard.tsx and
// in dashboard-triptych.tsx. A comment in two of them said so and said it was "worth collapsing" — and then it
// cost a real bug: the Opening Tour's Account stop was given its `data-tour` anchor in redesign-topbar.tsx, the
// ONE copy the tour never sees, because the tour only ever runs on the dashboard. The stop then vanished
// silently, because the tour drops any stop whose anchor isn't in the DOM. Jay found it on the first live walk
// (2026-08-13): "It didn't go to the account."
//
// Purely presentational — no hooks, no fetching — so it renders inside the server subpage shell and inside the
// client triptych alike. Whoever has the member's name and avatar passes them in.

export default function TopbarView({
  displayName,
  avatarUrl,
  greeting = false,
}: {
  displayName: string;
  avatarUrl: string | null;
  /** The dashboard says hello; subpages don't (the member strip below already greets them there). */
  greeting?: boolean;
}) {
  return (
    <div className="redesign-topbar">
      <Link href="/" className="rt-brand" aria-label="Go to your G4L home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rt-logo-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rt-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
      </Link>
      <div className="rt-who">
        {/* NO NAV ITEM AT ALL (Jay, 2026-08-15: "I don't even really think we need Playbook up there").
            Program came out on 8/8 as a syllabus better reached from the hero breadcrumb; the Playbook stayed
            because it is the daily instrument. What changed is the HEADER'S JOB. With the app-wide Companion
            dock decided against the same day, Playbook was the only thing up here doing something different
            from everything else: the logo and the avatar answer "where am I / how do I get home / who am I",
            and a destination link answers none of those. A header that means one thing beats a saved tap.
            The cost, stated plainly: from a Session or a subpage the Playbook is now home-then-Playbook. That
            only bites mid-Session — where a member arguably should not be leaving from anyway — and the
            dashboard routes there prominently with its own panel and "Open Your Playbook →". */}
        {/* data-tour: the Opening Tour's Account stop. The topbar is the ONLY place a member meets their account,
            and the tour never mentioned it — so reminders and privacy were things you had to go looking for. */}
        <span className="rt-account-group" data-tour="account">
          <Link href="/account" className="rt-account" aria-label="Your account">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rt-av" src={avatarUrl} alt={displayName} />
            ) : (
              <span className="rt-av rt-av-initials" aria-hidden="true">{initials(displayName)}</span>
            )}
            {greeting && <span className="rt-hi">Hi, {firstName(displayName)}</span>}
          </Link>
        </span>
      </div>
    </div>
  );
}
