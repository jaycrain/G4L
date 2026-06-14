import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { authorizeMember } from '../../authz.ts';
import type { Db } from '../../../lib/db/schema.ts';

// "More about your ID Score" — the explanation that used to crowd the dashboard panel. Stub to grow.
export default async function ScoreMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about your ID Score</h1></div>
      <div className="card">
        <p>
          Your ID Score is the mirror — a 0–100 read of how far you’ve drifted from yourself, across four
          dimensions: Physical, Self, Social, and Outlook. It moves slowly, on purpose. You retake the IDQ
          every 60 days, so the number reflects real change over time, not a daily mood. A lower score is
          never a verdict — it’s honest information about where the distance runs widest, and where the work
          will matter most.
        </p>
        {dash?.score?.context && <p className="muted">{dash.score.context}</p>}
      </div>
    </>
  );
}
