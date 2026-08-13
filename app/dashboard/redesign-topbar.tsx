import Link from 'next/link';
import { getDb } from '../../lib/db/index.ts';
import { initials } from '../../lib/member/avatar.ts';
import type { Db } from '../../lib/db/schema.ts';

// The shared app topbar (brand · Playbook · account). ONE source so every member surface — the
// dashboard, the workspace, and every subpage (Movement, Badges, …) — carries the same header (Jay's walk: the subpages
// were missing it). Self-fetching async SERVER component: pass ONLY memberId and it reads its own name/avatar, so any
// subpage is a one-line drop-in with no data wiring. Sticky, 64px; the account link → /account (which holds Log out).
// Pair it with <RedesignChrome/> on a subpage so the global brand-bar hides and you don't get two headers.
export default async function RedesignTopbar({ memberId }: { memberId: string }) {
  const db = (await getDb()) as unknown as Db;
  const row = (
    await db
      .query<{ display_name: string | null; avatar_url: string | null }>(
        'select display_name, avatar_url from member_profile where member_id=$1',
        [memberId],
      )
      .catch(() => ({ rows: [] as { display_name: string | null; avatar_url: string | null }[] }))
  ).rows[0];
  const displayName = row?.display_name ?? '';
  const avatarUrl = row?.avatar_url ?? null;

  return (
    <div className="redesign-topbar">
      <Link href="/" className="rt-brand" aria-label="Go to your G4L home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rt-logo-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rt-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
      </Link>
      <div className="rt-who">
        {/* ONE nav item, not two (Jay, 2026-08-08). Program came out because it is a SYLLABUS — read occasionally,
            and already reachable from the dashboard hero breadcrumb ("Program › Reclaim › …"), which is better
            placement than nav: it sits in the context of where the member actually is.
            The Playbook STAYS, and that asymmetry is the point. It is the daily instrument now — This week, the
            queue waiting on them, the plays to run — and subpages carry only "← Dashboard" otherwise, so dropping
            it too would make the most-used surface two taps from anywhere but home.
            Nothing replaces Program here. The header's job is brand · the daily thing · account, and it does all
            three; sparse is correct for a product whose centre is a conversation. */}
        <span className="rt-nav">
          <Link href={`/playbook/${memberId}`} prefetch={false}>Playbook</Link>
        </span>
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
          </Link>
        </span>
      </div>
    </div>
  );
}
