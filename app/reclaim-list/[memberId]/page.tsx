import PanelHeader from '../../components/panel-header.tsx';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { dashboardTriptychEnabled } from '../../../lib/dashboard/redesign.ts';
import { looksTrackable, suggestTracker } from '../../../lib/measure/store.ts';
import MeasureCard from '../../dashboard/measure-card.tsx';
import SubpageShell from '../../dashboard/subpage-shell.tsx';
import TrackThis from '../../dashboard/track-this.tsx';
import type { Db } from '../../../lib/db/schema.ts';

// The Reclaim List subpage — the full list with ROOM for the trackers. On the dashboard flank the Reclaim List stays a
// compact read (just the intentions); the trackers (a linked measure's progress + the "turn on a tracker" offer) take a
// lot of vertical space, so they live HERE where each item can breathe (Jay, 2026-07-22). Editing the list itself stays
// the Companion's job (propose→confirm→commit); this page is where you wire an item to your Movement and watch it — and
// where the Companion will help manage the trackers (planned). Flag-gated with the triptych (the only place that links
// here) so it's dark on prod until the triptych flips.
export default async function ReclaimListPage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!dashboardTriptychEnabled()) notFound();
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  if (!dash) return <p className="error">We couldn&apos;t find that member.</p>;
  await logEvent(db, memberId, 'page_view', { surface: 'reclaim-list' });

  return (
    <SubpageShell memberId={memberId}>
      <PanelHeader k="reclaimList" />
      <div className="card">
        <p className="card-subtitle">
          What you’re taking back. These are your intentions. Talk to your Companion to add or refine the list or to add
          a tracker.
        </p>
        {dash.reclaimItems.length === 0 ? (
          <p className="muted">Your list lands here once you name what you’re reclaiming with your Companion.</p>
        ) : (
          <ul className="reclaim-list-full">
            {dash.reclaimItems.map((item, i) => {
              const linked = item.id ? dash.measures.filter((m) => m.reclaimItemId === item.id) : [];
              const offerTrack = item.id && !item.reclaimed && linked.length === 0 && looksTrackable(item.text);
              return (
                <li key={i} className={`reclaim-row${item.reclaimed ? ' reclaimed' : ''}`}>
                  <div className="reclaim-row-text">
                    {item.reclaimed && <span className="rr-check" aria-label="reclaimed" title="Reclaimed">✓</span>}
                    {/* The anchor — the one item C1 marked as what the rest organises around. It already leads the
                        Session card and the list arrives anchor-first; this is the page a member opens to LOOK at
                        their list, so it was the one place the star was missing. */}
                    {item.anchor && <span className="rr-anchor" aria-label="Your anchor" title="Your anchor — what the rest of this list is in service of">★</span>}
                    {item.text}
                  </div>
                  {linked.map((m) => (
                    <MeasureCard key={m.id} memberId={memberId} measure={m} />
                  ))}
                  {offerTrack && (
                    <TrackThis memberId={memberId} reclaimItemId={item.id!} itemText={item.text} suggestion={suggestTracker(item.text)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* No Longer Central — items the member released while refining (C1). Not deleted: kept here, quietly, and
          restorable by asking the Companion. Never shown among active priorities (the dashboard bug Jay caught). */}
      {dash.releasedReclaimItems.length > 0 && (
        <div className="card reclaim-released">
          <div className="rc-h">No Longer Central</div>
          <p className="card-subtitle">You set these aside while refining your list. They’re kept here — tell your Companion if you want to bring one back.</p>
          <ul className="reclaim-list-full">
            {dash.releasedReclaimItems.map((item, i) => (
              <li key={i} className="reclaim-row released"><div className="reclaim-row-text muted">{item.text}</div></li>
            ))}
          </ul>
        </div>
      )}

      {/* NO "More about" block here on purpose. The Field Guide retirement (Jay 8/8) moved each element's
          explanation onto its own surface — but this page's lede ("What you're taking back. These are your
          intentions. Talk to your Companion to add or refine the list or to add a tracker.") already says
          everything the Field Guide entry said. A second telling directly beneath it is noise, not help. */}

    </SubpageShell>
  );
}
