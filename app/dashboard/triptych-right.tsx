import Link from 'next/link';
import type { Db } from '../../lib/db/schema.ts';
import type { Dashboard } from '../../lib/gateway/flow.ts';
import { pulseBeats } from '../../lib/momentum/store.ts';
import { getActivityPanel } from '../../lib/activity/store.ts';
import { stravaConfigured } from '../../lib/activity/strava.ts';
import { formatDistance, formatDuration } from '../../lib/activity/summary.ts';
import ResiliencePulse from './resilience-pulse.tsx';
import StravaConnect from '../account/strava-connect.tsx';
import ConnectPanel from './connect-panel.tsx';

// Triptych RIGHT flank — "What's Next" (act / forward motion): Momentum · Community · Movement · Reclaim List, in that
// order (Jay, 2026-07-27 — swapped Reclaim List ↔ Community). Server component; panels moved from redesign-dashboard AS-IS. The See-more foot link is
// normalized to a single consistent "See more →" (rreg-more) across every panel that has a subpage — subpages are now
// premium, so the nav must read as clearly tappable. The Reclaim List is Companion-edited (no subpage), so it keeps its
// "talk to your Companion" foot line rather than a fake See-more. NOT next-Session — that's the center hero's CTA.

export default async function TriptychRight({
  db,
  memberId,
  dash,
  momentumCta,
}: {
  db: Db;
  memberId: string;
  dash: Dashboard;
  momentumCta?: { label: string; href: string } | null;
}) {
  const [pulse, activity] = await Promise.all([
    pulseBeats(db, memberId).catch(() => []),
    getActivityPanel(db, memberId, dash.identityNoun),
  ]);

  return (
    <div className="tri-stack">
      {/* Momentum — the calls you make */}
      <div className="rcard r-reg">
        <div className="rreg-eyebrow">Momentum</div>
        <div className="rc-sub">The calls you make, one at a time.</div>
        <div className="rreg-mom-viz"><ResiliencePulse beats={pulse} bare /></div>
        <p className="rreg-mom-cap">Good Calls · False Starts · Quiet Days</p>
        {/* During a practice week the log CTA lives HERE (Jay), not the hero — replacing the plain See-more. */}
        <Link href={momentumCta?.href ?? `/momentum/${memberId}`} className="rreg-more">
          {momentumCta?.label ?? 'See more →'}
        </Link>
      </div>

      {/* Community — elevated peer panel (real data via ConnectPanel). Triptych CTA label per Jay (2026-07-22). */}
      <ConnectPanel memberId={memberId} ctaLabel="Connect with other members →" />

      {/* Movement — first-class evidence surface (Cycle 1: Strava) */}
      {activity.connected ? (
        <div className="rcard r-movement">
          <div className="rc-h">Movement</div>
          <div className="rc-sub">All your activity, in one place.</div>
          <div className="rm-sources">
            <span className="rm-chip on">Strava <b>Connected</b></span>
            <span className="rm-chip">Apple Health <b className="muted">Needs the app</b></span>
            <span className="rm-chip muted">+ 400 more</span>
          </div>
          <div className="rm-stats">
            <span><b>{activity.thisWeek.count}</b>this week</span>
            {formatDistance(activity.thisWeek.distanceM) && <span><b>{formatDistance(activity.thisWeek.distanceM)}</b>distance</span>}
            {formatDuration(activity.thisWeek.movingTimeS) && <span><b>{formatDuration(activity.thisWeek.movingTimeS)}</b>moving</span>}
          </div>
          {activity.line && <p className="rm-line">{activity.line}</p>}
          <p className="rm-foot">Full health data — weight, sleep — arrives with the mobile app.</p>
          <Link href={`/movement/${memberId}`} className="rreg-more">See more →</Link>
        </div>
      ) : (
        <div className="rcard r-movement">
          <div className="rc-h">Movement</div>
          <div className="rc-sub">Connect your activity — evidence of the identity coming back.</div>
          <div className="rm-sources">
            <span className="rm-chip">Strava <b className="muted">Connect</b></span>
            <span className="rm-chip">Apple Health <b className="muted">Needs the app</b></span>
            <span className="rm-chip muted">+ 400 more</span>
          </div>
          <StravaConnect connected={false} configured={stravaConfigured()} />
          <Link href={`/movement/${memberId}`} className="rreg-more">See more →</Link>
        </div>
      )}

      {/* Reclaim List — a COMPACT read of the intentions. The trackers (a linked measure + the "turn on a tracker" offer)
          take a lot of room, so they live on the subpage where each item can breathe (Jay, 2026-07-22) — that's the real
          See more →, not a fake one. Editing the list stays the Companion's job. */}
      <div className="rcard r-reclaim" data-tour="reclaim">
        <div className="rc-h">Reclaim List</div>
        <div className="rc-sub">What you’re taking back.</div>
        <ul className="r-reclaim-list">
          {dash.reclaimItems.map((item, i) => (
            <li key={i} className={item.reclaimed ? 'reclaimed' : undefined}>
              <span className="rr-text">
                {item.reclaimed && <span className="rr-check" aria-label="reclaimed" title="Reclaimed">✓</span>}
                {item.text}
              </span>
            </li>
          ))}
        </ul>
        <Link href={`/reclaim-list/${memberId}`} className="rreg-more">See more →</Link>
      </div>
    </div>
  );
}
