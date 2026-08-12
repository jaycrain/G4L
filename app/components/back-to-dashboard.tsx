'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

// W-47: a universal "← Dashboard" affordance on every member subpage + Session. The member's id is in the PATH on
// almost every route (/program/{id}, /rewire/{id}/w1, /reclaim/{id}/c1, …) and in the `?member=` QUERY on the IDQ
// retake — this reads both, so one component in the root layout covers them all. Renders nothing where there's no way
// "back" to (the dashboard itself, login, onboarding, admin). Query use → wrap in <Suspense> at the layout (Next 15).
const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

// Routes whose "back" is a SUBPAGE rather than the dashboard, because that is where the member came from.
const PARENTS: { test: RegExp; href: (id: string) => string; label: string }[] = [
  { test: /^\/quality-day\//, href: (id) => `/playbook/${id}`, label: 'Your Playbook' },
];

export default function BackToDashboard() {
  const pathname = usePathname() ?? '';
  const search = useSearchParams();

  // No "back" from the home surface itself, the pre-member flows, or admin (admin has its own navigation).
  if (pathname === '/onboarding' || pathname === '/login' || pathname.startsWith('/admin')) return null;

  const memberId = pathname.match(UUID_RE)?.[0] ?? search?.get('member') ?? undefined;
  if (!memberId || !UUID_RE.test(memberId)) return null; // no member context → nothing to go back to

  const dashboard = `/dashboard/${memberId}`;
  if (pathname === dashboard) return null; // already home

  // Sub-sub pages carry their OWN single back-nav to the parent subpage — e.g. a Community room shows only
  // "← G4L Community" (Jay, 2026-07-28). Suppress the global "← Dashboard" there so there's just one back affordance.
  if (/^\/connect\/[^/]+\/room\//.test(pathname)) return null;

  // SOME PAGES HANG OFF A SUBPAGE, NOT OFF HOME, and "back" should mean the place you came from. The Quality Days
  // log is reached by tapping "Log today →" on the Playbook's This week grid; sending the member to the dashboard
  // afterwards makes them navigate back into the Playbook to see the box they just ticked (Jay, 2026-08-12).
  // A TABLE, not another `if`. This is the third route to want a non-dashboard parent and the second to be given
  // one by hand; the next practice-week log surface should be one line here, not a new branch to discover.
  const parent = PARENTS.find((p) => p.test.test(pathname));
  if (parent) {
    return (
      <Link href={parent.href(memberId)} className="back-dash" aria-label={`Back to ${parent.label}`}>
        ← {parent.label}
      </Link>
    );
  }

  // When a subpage was reached FROM a workspace session (e.g. Full route → carries ?from=<sessionKey>), also offer a
  // "← Session" hop back to that session, so the member doesn't have to route Dashboard → back into the session. Same
  // styling as the Dashboard link; sits just ahead of it.
  const from = search?.get('from') ?? '';
  // On /program the "← Session" hop is rendered by the page itself, BELOW its header, so it doesn't crowd the top-of-page
  // "← Dashboard" (Jay's iPad walk). Everywhere else it sits inline here, just ahead of Dashboard.
  const onProgram = pathname.startsWith('/program/');
  const sessionBack = !onProgram && /^[a-z0-9-]{1,24}$/.test(from) ? `/workspace/${memberId}/${from}` : null;

  return (
    <>
      {sessionBack && (
        <Link href={sessionBack} className="back-dash" aria-label="Back to your session">
          ← Session
        </Link>
      )}
      <Link href={dashboard} className="back-dash" aria-label="Back to your dashboard">
        ← Dashboard
      </Link>
    </>
  );
}
