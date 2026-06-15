import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getPassport } from '../../../lib/curriculum/view.ts';
import type { Db } from '../../../lib/db/schema.ts';

// "More about your Badges" — the passport copy moved off the dashboard panel.
export default async function BadgesMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const passport = await getPassport(db, memberId);

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about your Badges</h1></div>
      <div className="card sub-copy">
        <p>Your Badges are the receipts — proof, in one place, of the real things you’ve actually done. Think passport stamps, not trophies: every one is the same size, each with its own color and design, and the point was never any single one. The point is how many you stack.</p>
        <p>A grid that fills as you go. The ones you’ve earned are lit; the ones still ahead are greyed in, so you can see what’s possible. Color tells you the kind — Milestones, Hardiness (stretches of grit), Goals reclaimed, and Comebacks (a real return after a slump). Some you can see coming. Some you won’t see until they land — earned, not expected.</p>
        <p>You don’t get one for showing up or logging in. You get one for the plays that count — passing a stretch of grit, reclaiming something on your list, coming back after a miss, crossing a Checkpoint. They’re meant to be hard. The accumulation is the whole game: a passport that fills is a life being won back.</p>
        <p>So don’t measure yourself against the one you don’t have yet. Look at the density — a board crowding with color is the story, told in stamps.</p>
        <p>Your first was the hardest to see coming: getting through onboarding and into this room. That one took facing yourself. The rest, you’ll stack.</p>
        <p className="muted">You’ve earned <strong>{passport.earned} of {passport.total}</strong> so far.</p>
        <div className="badge-legend">
          <span className="bl"><span className="bl-sw" style={{ background: '#374F63' }} />Milestones</span>
          <span className="bl"><span className="bl-sw" style={{ background: '#3B9495' }} />Hardiness</span>
          <span className="bl"><span className="bl-sw" style={{ background: '#919536' }} />Goals reclaimed</span>
          <span className="bl"><span className="bl-sw" style={{ background: '#EC6233' }} />Comebacks</span>
          <span className="bl"><span className="bl-sw bl-lock" />Still to earn</span>
        </div>
      </div>
    </>
  );
}
