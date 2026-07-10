import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import { pulseBeats } from '../../../lib/momentum/store.ts';
import { activePracticeWeek, practicePanelLine } from '../../../lib/practice/store.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../../../lib/rebuild/plan-store.ts';
import ResiliencePulse from '../../dashboard/resilience-pulse.tsx';
import MomentumLog, { type PilotDomains } from '../momentum-log.tsx';
import type { Db } from '../../../lib/db/schema.ts';

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

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>Momentum</h1></div>
      <div className="card">
        <p className="card-subtitle">The calls you make, one at a time — and how they add up. Self-monitoring, never scored — just yours to watch.</p>
        {practiceLine && <p className="practice-strip">{practiceLine}</p>}
        <ResiliencePulse beats={beats} />
        <MomentumLog memberId={memberId} pilot={pilot} />
      </div>
    </>
  );
}
