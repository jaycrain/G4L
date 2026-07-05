import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { latestGrintaReading } from '../../../lib/grinta/survey/store.ts';
import { authorizeMember } from '../../authz.ts';
import type { Db } from '../../../lib/db/schema.ts';

// "More about your Grinta Index" — the origin, what it measures, and how it grows. Data re-pointed to the SURVEY
// grinta (grinta_reading), NOT the activity register. The old 3-C (Commitment/Control/Challenge) copy is retired.
const R_RING: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
const STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;

export default async function GrintaMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const reading = await latestGrintaReading(db, memberId);

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about your Grinta Index</h1></div>

      {reading && (
        <div className="card metric grinta">
          <div className="score">
            <span className="num">{reading.composite}</span>
            <span className="grinta-scale">/ 5</span>
          </div>
          <div className="dims grinta-strands">
            {STRANDS.map((r) => {
              const v = reading.strands[r.key];
              return (
                <div className="dim" key={r.key}>
                  <span><span className="r-dot" style={{ background: R_RING[r.key] }} />{r.label}</span>
                  <span>{v != null ? `${v} / 5` : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card sub-copy">
        <h3>Where the name comes from</h3>
        <blockquote className="grinta-origin-quote">
          “Grinta means grit. Never give up. There’s a moment in the race, everybody struggling, but the one with
          more Grinta, keep going… he gonna win.”
          <cite>— Eros Poli, GRINTA!</cite>
        </blockquote>
        <p>
          Grinta is the Italian word for grit — there’s no tidy English translation. It’s what keeps you going when
          every reasonable voice says stop. That’s the whole idea behind this number. Your Grinta isn’t luck or a good
          mood — it’s built, one strand at a time. Reconnect, Rewire, Rebuild, Reclaim each add to it. Finish a strand
          and the number climbs; close the loop and you’ve built something that holds.
        </p>

        <h3>What it measures</h3>
        <p>
          Your Grinta Index is one number for your grit — built across the whole journey, one R at a time. Four
          strands, one per R: Reconnect (reconnecting with who you are), Rewire (retraining your mind), Rebuild
          (rebuilding your body), Reclaim (reclaiming your future). Each strand starts with the reading you gave at the
          very beginning; as you finish each R, that strand gets fuller and truer — and your Index moves.
        </p>

        <h3>How it grows</h3>
        <p>
          It isn’t a daily score and it isn’t a grade. It’s summative — it moves when you complete an R’s checkpoint,
          not day to day. Finish a strand and the number climbs; close the whole loop and you’ve built something that
          holds. It’s yours alone — your own scale, not a curve, not a comparison.
        </p>
      </div>
    </>
  );
}
