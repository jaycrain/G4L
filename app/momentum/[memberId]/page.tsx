import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import { pulseBeats, recentCalls, type CallType, type CallDomain } from '../../../lib/momentum/store.ts';
import { activePracticeWeek, practicePanelLine } from '../../../lib/practice/store.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../../../lib/rebuild/plan-store.ts';
import ResiliencePulse from '../../dashboard/resilience-pulse.tsx';
import MomentumLog, { type PilotDomains } from '../momentum-log.tsx';
import type { Db } from '../../../lib/db/schema.ts';

const CALL_LABEL: Record<CallType, string> = { good_call: 'Good Call', false_start: 'False Start', quiet_day: 'Quiet Day' };
const DOMAIN_LABEL: Record<CallDomain, string> = { activity: 'Movement', diet: 'Eating' };

// "Today" / "Yesterday" / a short date — a friendly day label for the history, from a YYYY-MM-DD string vs. today.
function dayLabel(loggedOn: string, todayISO: string): string {
  if (loggedOn === todayISO) return 'Today';
  const d = new Date(loggedOn + 'T00:00:00');
  const t = new Date(todayISO + 'T00:00:00');
  if (Math.round((t.getTime() - d.getTime()) / 86400000) === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// The Momentum quick-log surface (Slice 2) — the second logging door (FF). Flag-gated (REWIRE); the route does not
// exist in prod until the v2.3 flip. Shows the rolling-14-day pulse + a tap-to-log. Drift-hardened (empty on 0049).
export default async function MomentumPage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'momentum' });
  const beats = await pulseBeats(db, memberId).catch(() => []);
  // During an active B3 pilot week, offer the OPTIONAL activity/diet tag on each call (Decision OO), labelled from
  // the member's own plan. Drift-hardened: any read hiccup simply omits the tag (the log still works untagged).
  const pw = await activePracticeWeek(db, memberId).catch(() => null);
  const plan = pw?.kind === 'b3_pilot' ? await activeCoachingPlan<RebuildPilotPayload>(db, memberId, 'rebuild').catch(() => null) : null;
  const pilot: PilotDomains | null =
    plan?.payload.activityChange && plan?.payload.dietChange ? { activity: plan.payload.activityChange, diet: plan.payload.dietChange } : null;
  // W-25 — the active practice week's "this week" line, shown here as context (Momentum is its home now, not the hero).
  const practiceLine = await practicePanelLine(db, memberId);
  // The member's own log — where every call they make gets saved (Jay: "where does this get placed?").
  const log = await recentCalls(db, memberId).catch(() => []);
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="hero"><h1>Momentum</h1></div>
      <div className="card">
        <p className="card-subtitle">The calls you make, one at a time — and how they add up. Self-monitoring, never scored — just yours to watch.</p>
        {practiceLine && <p className="practice-strip">{practiceLine}</p>}
        <ResiliencePulse beats={beats} />
        <MomentumLog memberId={memberId} pilot={pilot} />
      </div>

      {/* Your log — the saved history, so a logged call has a visible home, not a dead end. */}
      <div className="card momentum-history">
        <h3>Your log</h3>
        {log.length === 0 ? (
          <p className="muted">Nothing logged yet. Every call you make — good, false start, or quiet — lands here, in order.</p>
        ) : (
          <ul className="mlog-list">
            {log.map((c, i) => (
              <li key={i} className={`mlog-row is-${c.type}`}>
                <span className="mlog-dot" aria-hidden="true" />
                <div className="mlog-body">
                  <div className="mlog-head">
                    <span className="mlog-type">{CALL_LABEL[c.type]}</span>
                    {c.domain && <span className="mlog-domain">{DOMAIN_LABEL[c.domain]}</span>}
                    <span className="mlog-day">{dayLabel(c.loggedOn, todayISO)}</span>
                  </div>
                  {c.note && <div className="mlog-note">{c.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Not a dead end — clear ways back into the program after logging. */}
      <div className="momentum-nav">
        <Link href={`/dashboard/${memberId}`} className="momentum-nav-primary">← Back to your path</Link>
        <Link href={`/program/${memberId}`} className="momentum-nav-secondary">See your Journey →</Link>
      </div>
    </>
  );
}
