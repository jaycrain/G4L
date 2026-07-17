import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import type { Db } from '../../../lib/db/schema.ts';
import { authorizeMember } from '../../authz.ts';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import { getActivityPanel } from '../../../lib/activity/store.ts';
import { stravaConfigured } from '../../../lib/activity/strava.ts';
import { formatDistance, formatDuration, typeLabel, relativeDay } from '../../../lib/activity/summary.ts';
import { listMovementLog } from '../../../lib/movement/store.ts';
import RedesignChrome from '../../dashboard/redesign-chrome.tsx';
import StravaConnect from '../../account/strava-connect.tsx';
import LogActivity from '../log-activity.tsx';

const KIND_LABEL: Record<string, string> = { walk: 'Walk', ride: 'Ride', run: 'Run', hike: 'Hike', swim: 'Swim', workout: 'Workout', other: 'Other' };

// Redesign Layer 3 — the MOVEMENT subpage (Decision YY): a first-class evidence surface. Connect the apps you already
// use → one unified view, read against who you're reclaiming, never left as raw numbers. Flag-gated (REDESIGN). Cycle 1
// = Strava direct; the aggregator sources (Fitbit/Garmin/…) + the Companion-logged history + Apple Health arrive with the
// app / ROOK (labeled honestly here, not faked).

// Extra sources beyond Strava — reachable via the aggregator (Cycle 2), shown as an honest forward-map, not fake buttons.
const SOON = [
  { name: 'Fitbit', what: 'Steps · heart rate · sleep' },
  { name: 'Garmin', what: 'Rides · runs · training' },
  { name: 'Withings', what: 'Weight · blood pressure' },
  { name: 'Peloton', what: 'Via your other apps' },
];

export default async function MovementPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!redesignEnabled()) redirect(`/dashboard/${memberId}`);
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;

  const noun = (await db.query<{ identity_noun: string | null }>('select identity_noun from member_profile where member_id=$1', [memberId])).rows[0]?.identity_noun ?? null;
  const activity = await getActivityPanel(db, memberId, noun).catch(() => null);
  const connected = activity?.connected ?? false;
  const recent = activity?.recent ?? [];
  const thisWeek = activity?.thisWeek ?? { count: 0, distanceM: 0, movingTimeS: 0 };

  // Member-logged activity (off-device) merges with the synced Strava history — one honest timeline, tagged by
  // provenance (teal = synced, bullseye = logged). Independent of a Strava connection, so it shows even when nothing
  // is connected.
  const logged = await listMovementLog(db, memberId).catch(() => []);
  type MvEntry = { provenance: 'synced' | 'logged'; daysAgo: number; label: string; meta: string | null; note: string | null; source: 'strava' | 'self' | 'companion' };
  const entries: MvEntry[] = [
    ...recent.map((a): MvEntry => ({ provenance: 'synced', daysAgo: a.daysAgo, label: typeLabel(a.type), meta: formatDistance(a.distanceM) || null, note: null, source: 'strava' })),
    ...logged.map((l): MvEntry => ({ provenance: 'logged', daysAgo: l.daysAgo, label: KIND_LABEL[l.activityType] ?? l.activityType, meta: null, note: l.note, source: l.source })),
  ].sort((a, b) => a.daysAgo - b.daysAgo); // newest first
  const stravaDays = new Set(recent.map((a) => a.daysAgo)).size; // active days from synced Strava activity (for its card)
  const groups: { label: string; items: MvEntry[] }[] = [];
  for (const e of entries) {
    const label = relativeDay(e.daysAgo) || `${e.daysAgo}d ago`;
    const g = groups.find((x) => x.label === label) ?? (groups.push({ label, items: [] }), groups[groups.length - 1]!);
    g.items.push(e);
  }

  return (
    <>
      <RedesignChrome />
      <div className="mv-wrap">
        <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
        <div className="hero"><h1>Movement</h1></div>
        <p className="mv-lede">Everything you’re doing, in one place. Connect the apps you already use, and the Companion adds what you tell it along the way. Read against who you’re reclaiming — never left as raw numbers.</p>

        {/* Connect sources */}
        <div className="mv-sources">
          <div className="mv-sources-h">Connect your sources</div>
          <div className="mv-source-grid">
            <div className="mv-source on">
              <div><div className="mv-source-name">Strava</div><div className="mv-source-what">Rides · runs · activities</div></div>
              {connected ? <span className="mv-badge on">Connected</span> : <span className="mv-connect"><StravaConnect connected={false} configured={stravaConfigured()} /></span>}
            </div>
            <div className="mv-source">
              <div><div className="mv-source-name">Apple Health</div><div className="mv-source-what">Weight · sleep · steps</div></div>
              <span className="mv-badge">Needs the app</span>
            </div>
            {SOON.map((s) => (
              <div className="mv-source" key={s.name}>
                <div><div className="mv-source-name">{s.name}</div><div className="mv-source-what">{s.what}</div></div>
                <span className="mv-badge">Soon</span>
              </div>
            ))}
          </div>
          <p className="mv-sources-foot">Oura, Whoop, Google Health &amp; 400 more — one connection covers them all, with the app.</p>
        </div>

        {/* Strava — its own titled card, floating, with the synced summary (only when connected) */}
        {connected && (
          <div className="mv-strava">
            <div className="mv-strava-head">
              <h2 className="mv-strava-title">Strava</h2>
              <span className="mv-badge on">Connected</span>
            </div>
            <div className="mv-week">
              <span><b>{thisWeek.count}</b>this week</span>
              {formatDistance(thisWeek.distanceM) && <span><b>{formatDistance(thisWeek.distanceM)}</b>distance</span>}
              {formatDuration(thisWeek.movingTimeS) && <span><b>{formatDuration(thisWeek.movingTimeS)}</b>moving</span>}
              <span><b>{stravaDays}</b>active days</span>
            </div>
            {activity?.line && <p className="mv-strava-line">{activity.line}</p>}
          </div>
        )}

        {/* Log an activity done off-device */}
        <LogActivity memberId={memberId} />

        {/* History — synced + self-logged, merged */}
        <div className="mv-history">
          <div className="mv-history-h">Your history</div>
          <p className="mv-history-lede">Everything you’ve done and everything you’ve told me — kept in order, so the story of your movement stays whole.</p>
          {groups.length === 0 ? (
            <p className="muted">Once you connect a source, log an activity above, or tell your Companion about a walk, it lands here — in order.</p>
          ) : (
            groups.map((g) => (
              <div className="mv-day" key={g.label}>
                <div className="mv-day-label">{g.label}</div>
                <div className="mv-day-items">
                  {g.items.map((e, i) => (
                    <div className="mv-entry" key={i}>
                      <span className={`mv-dot ${e.provenance}`} aria-hidden="true" />
                      <div className="mv-entry-head">
                        <span className="mv-entry-type">{e.label}</span>
                        <span className="mv-src-chip">{e.source === 'strava' ? 'Strava' : e.source === 'companion' ? 'Companion' : 'You'}</span>
                      </div>
                      {e.meta && <div className="mv-entry-meta">{e.meta}</div>}
                      {e.note && <div className="mv-entry-meta mv-entry-note">{e.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
