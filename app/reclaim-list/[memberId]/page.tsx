import PanelHeader from '../../components/panel-header.tsx';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { dashboardTriptychEnabled } from '../../../lib/dashboard/redesign.ts';
import { suggestTracker } from '../../../lib/measure/store.ts';
import { classifyGoal, cadenceTarget } from '../../../lib/reclaim/goal-kind.ts';
import { trackedReclaimItemIds } from '../../../lib/practice/mark.ts';
import { weekGrids } from '../../../lib/practice/grid.ts';
import Link from 'next/link';
import TrackWeekly from '../../dashboard/track-weekly.tsx';
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
  // Which items already have a week open, so a tracked item stops re-offering. Drift-hardened: if this read
  // fails the page still renders — the worst case is an offer shown twice, and trackReclaimItem is idempotent.
  const tracked = await trackedReclaimItemIds(db, memberId).catch(() => new Set<string>());
  // THE LIVE STATE OF A TRACKED ITEM, not just "is it tracked". Jay tapped "Track this week" on two items and
  // the page went BLANK where the buttons had been — the offer removed itself and nothing took its place, so it
  // read as "my trackers were deleted". A measure has always had MeasureCard standing in that spot; a cadence
  // had nothing. The row is keyed by slot, which is the Reclaim item's id.
  const cadenceRows = new Map<string, { done: number; target: number | null; days: number }>();
  try {
    const g = (await weekGrids(db, memberId)).find((w) => w.kind === 'reclaim_item');
    for (const r of g?.rows ?? []) cadenceRows.set(r.slot, { done: r.done, target: r.target, days: g!.window.days });
  } catch {
    /* the row state is a nicety; a failed read must not take the list down */
  }
  if (!dash) return <p className="error">We couldn&apos;t find that member.</p>;
  await logEvent(db, memberId, 'page_view', { surface: 'reclaim-list' });

  return (
    <SubpageShell memberId={memberId}>
      <PanelHeader k="reclaimList" />
      <div className="card">
        {/* Trimmed 2026-08-13: the header now carries "what you're taking back" AND "add or refine anytime with
            your Companion", so this said both again four lines later. The tracker is the one thing it added. */}
        <p className="card-subtitle">Ask your Companion to add a tracker to any of these.</p>
        {dash.reclaimItems.length === 0 ? (
          <p className="muted">Your list lands here once you name what you’re reclaiming with your Companion.</p>
        ) : (
          <ul className="reclaim-list-full">
            {dash.reclaimItems.map((item, i) => {
              const linked = item.id ? dash.measures.filter((m) => m.reclaimItemId === item.id) : [];
              // ONE AFFORDANCE PER KIND OF GOAL (#155). This used to be a single `looksTrackable` test, which
              // offered a trend tracker on a one-time race placing and nothing at all on "3 times per week".
              // The classifier decides; a measure gets the tracker form, a cadence gets the week, an outcome
              // and a plain intention get nothing — which is the right answer, not a gap.
              const kind = item.id && !item.reclaimed ? classifyGoal(item.text) : 'none';
              const offerTrack = kind === 'measure' && linked.length === 0;
              const offerWeekly = kind === 'cadence' && !tracked.has(item.id!);
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
                  {offerWeekly && (
                    <TrackWeekly memberId={memberId} reclaimItemId={item.id!} itemText={item.text} target={cadenceTarget(item.text)} />
                  )}
                  {/* TRACKED — the counterpart to MeasureCard. Says it is running, how the week is going, and
                      where the grid lives. Without this the row simply lost its button and looked broken. */}
                  {kind === 'cadence' && tracked.has(item.id!) && (() => {
                    const r = cadenceRows.get(item.id!);
                    return (
                      <div className="rr-tracking">
                        <span className="rr-tracking-dot" aria-hidden="true" />
                        <span className="rr-tracking-state">
                          {r
                            ? `Tracking this week · ${r.done} of ${r.target ?? r.days}`
                            : 'Tracking this week'}
                        </span>
                        <Link className="rr-tracking-link" href={`/playbook/${memberId}?tab=thisweek`}>Open the week →</Link>
                      </div>
                    );
                  })()}
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
