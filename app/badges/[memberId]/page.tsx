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
        <Link href={`/dashboard/${memberId}`} className="back-link">← Back to dashboard</Link>
      </div>
      <div className="hero"><h1>More about your Badges</h1></div>
      <div className="card">
        <p>
          You’ve earned <strong>{passport.earned} of {passport.total}</strong>. Each badge is a real thing you
          did — and they won’t come easy. Not for showing up or logging in; for the plays that count: passing
          a stretch of grit, reclaiming something on your list, coming back after a slump, crossing a
          Checkpoint. They’re the same size on purpose — the point isn’t any single one, it’s how many you
          stack. Some you can see coming, greyed in until you earn them; some you won’t see until they land.
        </p>
      </div>
    </>
  );
}
