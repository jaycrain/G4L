'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

// W-47: a universal "← Dashboard" affordance on every member subpage + Session. The member's id is in the PATH on
// almost every route (/program/{id}, /rewire/{id}/w1, /reclaim/{id}/c1, …) and in the `?member=` QUERY on the IDQ
// retake — this reads both, so one component in the root layout covers them all. Renders nothing where there's no way
// "back" to (the dashboard itself, login, onboarding, admin). Query use → wrap in <Suspense> at the layout (Next 15).
const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export default function BackToDashboard() {
  const pathname = usePathname() ?? '';
  const search = useSearchParams();

  // No "back" from the home surface itself, the pre-member flows, or admin (admin has its own navigation).
  if (pathname === '/onboarding' || pathname === '/login' || pathname.startsWith('/admin')) return null;

  const memberId = pathname.match(UUID_RE)?.[0] ?? search?.get('member') ?? undefined;
  if (!memberId || !UUID_RE.test(memberId)) return null; // no member context → nothing to go back to

  const dashboard = `/dashboard/${memberId}`;
  if (pathname === dashboard) return null; // already home

  // When a subpage was reached FROM a workspace session (e.g. Full route → carries ?from=<sessionKey>), also offer a
  // "← Session" hop back to that session, so the member doesn't have to route Dashboard → back into the session. Same
  // styling as the Dashboard link; sits just ahead of it.
  const from = search?.get('from') ?? '';
  const sessionBack = /^[a-z0-9-]{1,24}$/.test(from) ? `/workspace/${memberId}/${from}` : null;

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
