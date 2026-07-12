import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { reclaimEnabled } from '../../../lib/agent/reclaim.ts';
import { activeQualityDayProfile, profileElements, recentQualityDays } from '../../../lib/reclaim/quality-day-store.ts';
import QualityDayLog from '../quality-day-log.tsx';
import type { Db } from '../../../lib/db/schema.ts';

// The Quality-Day daily log surface (Reclaim C3 Step 2). Flag-gated (RECLAIM). Shows the member's Quality-Day elements
// (from their coach-defined profile) + a tap-to-log for today. Drift-hardened (degrades if 0055/profile absent).
export default async function QualityDayPage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const profile = await activeQualityDayProfile(db, memberId).catch(() => null);
  const elements = profile ? profileElements(profile) : [];
  const recent = await recentQualityDays(db, memberId).catch(() => []);
  const avg = recent.length ? Math.round((recent.reduce((s, r) => s + r.score, 0) / recent.length) * 10) / 10 : null;

  return (
    <>
      <div className="hero"><h1>Quality Days</h1></div>
      <div className="card">
        <p className="card-subtitle">
          Defining what makes a day yours — and noticing it, one day at a time.{avg != null ? ` This week so far: ${avg} / 10 across ${recent.length} day${recent.length === 1 ? '' : 's'}.` : ''}
        </p>
        {profile ? (
          <QualityDayLog memberId={memberId} elements={elements} />
        ) : (
          <p className="card-subtitle">Define your Quality Day first — it starts in the C3 session.</p>
        )}
      </div>
    </>
  );
}
