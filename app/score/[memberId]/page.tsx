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
      <div className="card sub-copy">
        {dash?.score && (
          <p className="sub-personal">Your ID Score right now is <strong>{Math.round(dash.score.score)}</strong>. {dash.score.context}</p>
        )}
        <p>Your ID Score is the mirror — and like any honest mirror, it won’t flatter you and it won’t lie. It’s a single 0–100 read of how close you are to the person you’re reclaiming, drawn from four corners of a life: your Physical self, your Self, your Social world, and your Outlook.</p>
        <p>The big number is the whole picture. The four dimensions beneath it show where the distance runs widest — and a low one there isn’t a failing grade, it’s a map. It’s telling you exactly where the work will pay off most.</p>
        <p>It comes from the IDQ — twenty-four honest questions you answer about every 60 days. That pace is on purpose. Who you are doesn’t lurch from week to week, so neither should this. The ID Score is built to move slowly, so that when it does move, you know you earned it — real change, not a good night’s sleep.</p>
        <p>So don’t chase it daily; you won’t catch it moving, and that’s the point. Do the reps, and let the next IDQ tell the truth. When the number climbs, that isn’t a better score — it’s more of you, back.</p>
        <p>This is your starting line, not your verdict. Everything from here is the gap, closing.</p>
      </div>
    </>
  );
}
