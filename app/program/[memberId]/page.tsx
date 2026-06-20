import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getForecast } from '../../../lib/curriculum/view.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import ProgramMap from '../../dashboard/program-map.tsx';
import type { Db } from '../../../lib/db/schema.ts';

// Your Program — the full four-phase curriculum map (Dashboard Reshuffle §4). It moved off the dashboard,
// where the panel now shows only the lit next Session; the whole path lives here. Renders from the
// curriculum registry (data→renderer) — no content change.
export default async function ProgramPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const forecast = await getForecast(db, memberId);
  await logEvent(db, memberId, 'page_view', { surface: 'program' });

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero">
        <h1>The Program</h1>
        <p className="heromore">Every step in the framework, start to finish — so you always know what you&apos;re walking into. Your next Session is lit.</p>
      </div>
      <div className="card curric">
        <ProgramMap memberId={memberId} phases={forecast.phases} />
      </div>
    </>
  );
}
