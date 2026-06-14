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
        <Link href={`/dashboard/${memberId}`} className="back-link">← Back to dashboard</Link>
      </div>
      <div className="hero"><h1>More about your Grinta Index</h1></div>
      <div className="card">
        <p>{grinta.line}</p>
        <p className="muted">Your daily effort moves this. Your ID Score is where it lands when you next take the IDQ.</p>
        <p className="muted" style={{ marginTop: '0.9rem' }}>
          Grit shows up in three ways: <strong>Consistency</strong> (showing up), <strong>Recovery</strong> (clipping
          back in after a miss), and <strong>Reach</strong> (doing the hard thing). Each one builds with the reps and
          has a line to cross — the markers on the sliders.
        </p>
      </div>
    </>
  );
}
