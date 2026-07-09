import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import { pulseBeats } from '../../../lib/momentum/store.ts';
import ResiliencePulse from '../../dashboard/resilience-pulse.tsx';
import MomentumLog from '../momentum-log.tsx';
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

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>Momentum</h1></div>
      <div className="card">
        <p className="card-subtitle">The calls you make, one at a time — and how they add up. Self-monitoring, never scored — just yours to watch.</p>
        <ResiliencePulse beats={beats} />
        <MomentumLog memberId={memberId} />
      </div>
    </>
  );
}
