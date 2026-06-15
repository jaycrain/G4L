import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { getGrinta } from '../../../lib/grinta/index.ts';
import { authorizeMember } from '../../authz.ts';
import type { Db } from '../../../lib/db/schema.ts';

// "More about your Grinta Index" — the copy moved off the dashboard panel + how the three components read.
export default async function GrintaMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  const grinta = await getGrinta(db, memberId, dash?.identityNoun ?? null);

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about your Grinta Index</h1></div>
      <div className="card sub-copy">
        {grinta.line && <p className="sub-personal">{grinta.line}</p>}
        <p>The ID Score tells you where you are. The Grinta Index tells you how hard you’re fighting to get back — and it’s the engine that actually moves the mirror. Grinta is Italian for grit, and this is yours, measured.</p>
        <p>One number for your grit right now, and three ways it shows up: Consistency (showing up), Recovery (clipping back in after a miss), and Reach (doing the hard thing on purpose). Each has a slider that fills as you put in the reps — and a marker on it, the line you’re working to cross. Cross it, and you’ve passed that stretch of grit. That one’s worth a badge.</p>
        <p>Unlike the ID Score, this one’s alive — it moves every time you show up. Your daily effort lands here first, and then, over the slow weeks, it shows up in your ID Score when you next take the IDQ. Grit is the cause; reclaiming is the effect.</p>
        <p>It’s the honest, slightly tough-love number. It won’t pretend you’re harder than you are, and it won’t let you coast — but it’s also the most responsive thing on your dashboard. Show up tomorrow, and you’ll see it.</p>
        <p>Nobody reclaims themselves by waiting to feel ready. You build the grit; the grit does the work. That’s the whole engine.</p>
      </div>
    </>
  );
}
