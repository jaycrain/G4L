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
        <p>Your ID Score tells you where you are. Your Grinta Index is your grit — the part that keeps you going when motivation runs out. Grinta is Italian for grit, and this is yours. It’s the engine of the whole thing.</p>

        <h3>Three ways grit shows up</h3>
        <p>Grinta is built from three habits of a hardy person. You build them by doing the work; they’re scored at your Checkpoints.</p>
        <ul className="sub-list">
          <li><strong>Commitment</strong> — you have a reason, and you show up for it.</li>
          <li><strong>Control</strong> — you run your life and your choices, instead of them running you.</li>
          <li><strong>Challenge</strong> — you move toward the hard, growthful thing on purpose, instead of away from it.</li>
        </ul>

        <h3>How it’s built, and how it’s measured</h3>
        <p>Every Session you finish and every day you log is a rep — that’s the work that builds grit. You’ll feel that daily effort as your own pulse: showing up, and clipping back in after a miss, always counts. A slip you notice and recover from is the muscle working, not a mark against you.</p>
        <p>The score itself updates at each Checkpoint — the look-back at the end of every R. Each of the three habits has a level you’re building, and a line you’re working to cross. Cross it, and you’ve earned that stretch of grit — sometimes a badge with it. The Checkpoint is where the reps you’ve banked get counted.</p>

        <h3>Grit and the mirror, side by side</h3>
        <p>Watch your Grinta and your ID Score move together over time. They’re two true pictures of the same comeback — grit is how hard you’re working, the ID Score is how reconnected you feel. We don’t claim one mechanically drives the other; we just keep both honest, and let you see them rise alongside each other.</p>
        <p>It’s the slightly tough-love number. It won’t pretend you’re further along than you are, and it won’t let you coast. But it’s also the most rewarding one to watch, because it answers to one thing only: the work you put in.</p>
        <p>Nobody reclaims themselves by waiting to feel ready. You build the grit; the grit does the work. That’s the whole engine.</p>
      </div>
    </>
  );
}
