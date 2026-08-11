import { softRead } from '../../lib/db/degrade.ts';
import Link from 'next/link';
import { playbookSummary } from '../../lib/playbook/summary.ts';
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
  waitingCount = 0,
  momentumCta,
}: {
  db: Db;
  memberId: string;
  dash: Dashboard;
  /** Lines said in a Session, waiting in the Journal — rendered inside the Playbook panel. */
  waitingCount?: number;
  momentumCta?: { label: string; href: string } | null;
}) {
  const [pulse, activity, playbook] = await Promise.all([
    softRead('triptychRight.pulseBeats', memberId, () => pulseBeats(db, memberId), []),
    getActivityPanel(db, memberId, dash.identityNoun),
    playbookSummary(db, memberId),
  ]);

  return (
    <div className="tri-stack">
      {/* YOUR PLAYBOOK — LEADS the act column (Jay, 2026-08-08). It sat at the top of the REFLECT column until
          tonight, on the reasoning that "what you've built" should come before "how you score". That was right
          while the Playbook was a RECORD.
          It stopped being one: it now holds This week, the queue waiting on you, and the plays to run. That is
          not reflection, it is the next action — and the mobile tab for this column is literally "What's next".
          The panel follows the artifact. Left keeps the three measures; this column leads with the instrument.

          IT USED TO HIDE AT ZERO — "so it never reads as an empty promise to a brand-new member." That was right
          when nothing had promised them a Playbook yet. The 2026-08-10 reframe makes the promise explicitly, at
          the welcome pact, before any work starts: "You'll build a Playbook. It's yours to keep." Hiding the panel
          after saying that is what breaks the promise — we name the destination and then the destination is not
          on screen. It cost the Opening Tour its Playbook stop too, silently: the tour filters out any stop whose
          target element is absent, so a brand-new member was never told the Playbook existed.

          So it always renders, and at zero it FORECASTS. Same call as the tab counts: a visible zero reads as
          "this fills up"; absence reads as "this isn't for you." (Jay's walk, 2026-08-11.) */}
      {playbook && (
        <div className="rcard r-reg" data-tour="playbook">
          <div className="rreg-eyebrow">Your Playbook</div>
          <div className="rc-sub">{playbook.plays > 0 ? 'What you’ve built.' : 'Where your Comeback gets kept.'}</div>
          <div className="rreg-big rreg-plays">
            {playbook.plays}<span className="rreg-unit"> {playbook.plays === 1 ? 'play' : 'plays'}</span>
          </div>
          {playbook.plays === 0 && <div className="pb-forecast">Your first one lands when you finish a Session.</div>}
          {playbook.mostRun && (
            <div className="pb-mostrun">
              <span className="pb-mostrun-label">Most run</span>
              <span className="pb-mostrun-name">{playbook.mostRun}</span>
            </div>
          )}
          {/* Lines they SAID in a Session, waiting in the Journal — the daily reason to come back. It sits with
              the Playbook because that is where it goes, and OFF the Companion thread because three pinned items
              above the composer crowded out the conversation itself. */}
          {waitingCount > 0 && (
            <Link href={`/playbook/${memberId}?tab=journal`} className="pb-waiting pb-waiting-sm" prefetch={false}>
              <span className="pb-waiting-n">{waitingCount}</span>
              <span>{waitingCount === 1 ? 'thing you said is waiting' : 'things you said are waiting'}</span>
            </Link>
          )}
          <Link href={`/playbook/${memberId}`} className="see-more" prefetch={false}>Open your Playbook →</Link>
        </div>
      )}


      {/* Momentum — the calls you make */}
      <div className="rcard r-reg" data-tour="momentum">
        <div className="rreg-eyebrow">Momentum</div>
        <div className="rc-sub">The calls you make, one at a time.</div>
        <div className="rreg-mom-viz"><ResiliencePulse beats={pulse} bare /></div>
        <p className="rreg-mom-cap">Good Calls · False Starts · On Track</p>
        {/* During a practice week the log CTA lives HERE (Jay), not the hero — replacing the plain See-more. */}
        <Link href={momentumCta?.href ?? `/momentum/${memberId}`} className="rreg-more">
          {momentumCta?.label ?? 'See more →'}
        </Link>
      </div>

      {/* Community — elevated peer panel (real data via ConnectPanel). Triptych CTA label per Jay (2026-07-22). */}
      <ConnectPanel memberId={memberId} ctaLabel="Connect with other members →" />

      {/* Movement — first-class evidence surface (Cycle 1: Strava) */}
      {activity.connected ? (
        <div className="rcard r-movement" data-tour="movement">
          <div className="rc-h">Movement</div>
          <div className="rc-sub">All your activity, in one place.</div>
          <div className="rm-sources">
            <span className="rm-chip on">Strava <b>Connected</b></span>
            <span className="rm-chip">Apple Health <b className="muted">Soon</b></span>
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
        <div className="rcard r-movement" data-tour="movement">
          <div className="rc-h">Movement</div>
          <div className="rc-sub">Connect apps to automatically record activity.</div>
          <div className="rm-sources">
            <span className="rm-chip">Strava <b className="muted">Connect</b></span>
            <span className="rm-chip">Apple Health <b className="muted">Soon</b></span>
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
        {dash.reclaimItems.length ? (
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
        ) : (
          // Empty-state parity with the /reclaim-list subpage (CAT-47) — never a blank card when all items are released.
          <p className="rc-empty">Your list lands here as you name what you’re taking back.</p>
        )}
        <Link href={`/reclaim-list/${memberId}`} className="rreg-more">See more →</Link>
      </div>
    </div>
  );
}
